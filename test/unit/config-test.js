const assert = require('chai').assert;
const springCloudConfig = require('../../index');
var sinon = require('sinon');
var cloudConfigClient = require("cloud-config-client");

describe('spring-cloud-config-client', function() {

	describe("#readYaml()", function () {
		it("should read test yaml without profiles", function () {
			return springCloudConfig.readYaml('./test/fixtures/test.yml')
			.then((testProperties) => {
				assert.deepEqual(testProperties['test.unit.testBool'], true);
				assert.deepEqual(testProperties['test.unit.testString'], 'testing');
				assert.deepEqual(testProperties['test.unit.testNumber'], 12345);
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});

		it("should read yaml and parse doc by profiles", function () {
			return springCloudConfig.readYaml('./test/fixtures/test-yaml-docs.yml', ['development'])
			.then((testProperties) => {
				assert.deepEqual(testProperties['test.unit.testBool'], true);
				assert.deepEqual(testProperties['test.unit.testString'], 'testing again');
				assert.deepEqual(testProperties['test.unit.testNumber'], 23456);
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});

		it("should read yaml and parse doc by profiles, even with multiple profiles", function () {
			return springCloudConfig.readYaml('./test/fixtures/test-yaml-with-profiles.yml', ['env1','env4'])
			.then((testProperties) => {
				assert.deepEqual(testProperties['urlProperty'], 'http://www.testdomain-shared.com');
				assert.deepEqual(testProperties['propertyGroup']['groupProperty'], false);
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});
	});

	describe("#mergeProperties()", function () {
		it("should merge properties between two files", function () {
			return new Promise((resolve, reject) => {
				var obj1 = {
					'test.unit.testBool': true,
					'test.unit.testString': 'testing',
					'test.unit.testNumber': 12345
				};
				var obj2 = {
					'test.unit.testBool': true,
					'test.unit.testString': 'testing again',
					'test.unit.testNumber': 12345
				};

				var mergedProperties = springCloudConfig.mergeProperties([obj1, obj2]);
				assert.deepEqual(mergedProperties['test.unit.testBool'], true);
				assert.deepEqual(mergedProperties['test.unit.testString'], 'testing again');
				assert.deepEqual(mergedProperties['test.unit.testNumber'], 12345);
				resolve();
			});
		});
	});

	describe("#parsePropertiesToObjects()", function () {
		it("should parse dot-separated properties into JS object", function () {
			return new Promise((resolve, reject) => {
				const mergedProperties = {
					'test.unit.testBool': true,
					'test.unit.testString': 'testing again',
					'test.unit.testNumber': 12345
				};
				const expectedObject = {
					test: {
						unit: {
							testBool: true,
							testString: 'testing again',
							testNumber: 12345
						}
					}
				};
				const configObject = springCloudConfig.parsePropertiesToObjects(mergedProperties);
				assert.deepEqual(configObject, expectedObject);
				resolve();
			});
		});
	});

	describe("#createObjectForProperty()", function () {
		it("should construct a JS Object given a Boolean property's keys and value", function () {
			return new Promise((resolve, reject) => {
				const expectedObjectFromBool = {
					test: {
						unit: {
							testBool: true
						}
					}
				};
				const boolObject = springCloudConfig.createObjectForProperty(['test', 'unit', 'testBool'], true);
				assert.deepEqual(boolObject, expectedObjectFromBool);
				resolve();
			});
		});

		it("should construct a JS Object given a String property's keys and value", function () {
			return new Promise((resolve, reject) => {
				const expectedObjectFromString = {
					test: {
						unit: {
							testString: 'testing'
						}
					}
				};
				const stringObject = springCloudConfig.createObjectForProperty(['test', 'unit', 'testString'], 'testing');
				assert.deepEqual(stringObject, expectedObjectFromString);
				resolve();
			});
		});

		it("should construct a JS Object given a Number property's keys and value", function () {
			return new Promise((resolve, reject) => {
				const expectedObjectFromNumber = {
					test: {
						unit: {
							testNumber: 12345
						}
					}
				};
				const numberObject = springCloudConfig.createObjectForProperty(['test', 'unit', 'testNumber'], 12345);
				assert.deepEqual(numberObject, expectedObjectFromNumber);
				resolve();
			});
		});
	});

	describe('#shouldUseDocument()', function() {

		it('should not use undefined document', function() {
			let doc = undefined;
			let activeProfiles = ['aProfile'];
			assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), false);
		});

		it('should not use document that has profiles, but no activeProfiles input',
				function() {
					let doc = {'profiles': 'aProfile'};
					let activeProfiles;
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), false);
				});

		it('should use document when doc.profiles is undefined', function() {
			let doc = {};
			let activeProfiles = ['aProfile'];
			assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
		});

		it('should use document when activeProfiles matches a single doc.profiles',
				function() {
					let doc = {'profiles': 'devEast'};
					let activeProfiles = ['devEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
				});

		it('should use document when one of activeProfiles matches one of doc.profiles',
				function() {
					let doc = {'profiles': 'devEast,devWest,stagingEast'};
					let activeProfiles = ['devEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					activeProfiles = ['devWest'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					activeProfiles = ['stagingEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
				});

		it('should use document when multiple doc.profiles match active profiles',
				function() {
					let doc = {'profiles': 'devEast,devWest,stagingEast'};
					let activeProfiles = ['devEast','devWest'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					activeProfiles = ['devWest','stagingEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					activeProfiles = ['stagingEast','devEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
				});

		it('should NOT use document when not operator used in doc.profiles for active profile',
				function() {
					let doc = {'profiles': 'devEast,!devWest,stagingEast'};
					let activeProfiles = ['devEast','devWest'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), false);
					activeProfiles = ['devWest','stagingEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), false);
				});

		it('should use document when not operator used in doc.profiles for non-active profile',
				function() {
					let doc = {'profiles': 'devEast,devWest,!stagingEast'};
					let activeProfiles = ['devEast','devWest'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					doc = {'profiles': 'devEast,!devWest,stagingEast'};
					activeProfiles = ['devEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
					doc = {'profiles': '!devEast,devWest,stagingEast'};
					activeProfiles = ['devWest','stagingEast'];
					assert.deepEqual(springCloudConfig.shouldUseDocument(doc, activeProfiles), true);
				});
	});

	describe('#load()', function() {

		beforeEach(function () {
			this.sandbox = sinon.sandbox.create();
		});

		afterEach(function () {
			this.sandbox.restore();
		});

		it('should load default configs with no profile', function() {
			var cloudLoadStub = this.sandbox.stub(cloudConfigClient, 'load').returns(
				Promise.resolve({forEach(callback, aBoolValue) {}})
			);
			let options = {
				configPath: './test/config',
				activeProfiles: [],
				level: 'debug'
			}
			return springCloudConfig.load(options).then((config) => {
				assert.deepEqual(config.name, 'the-application-name');
				assert.deepEqual(config.testUrl, 'http://www.default.com');
				assert.deepEqual(config.endpoint, 'http://localhost:8888');
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});
		it('should load dev configs with dev profile', function() {
			var cloudLoadStub = this.sandbox.stub(cloudConfigClient, 'load').returns(
				Promise.resolve({forEach(callback, aBoolValue) {}})
			);
			let options = {
				configPath: './test/config',
				activeProfiles: ['dev2'],
				level: 'debug'
			}
			return springCloudConfig.load(options).then((config) => {
				assert.deepEqual(config.name, 'the-application-name');
				assert.deepEqual(config.testUrl, 'http://www.dev.com');
				assert.deepEqual(config.endpoint, 'http://dev-config-server:8888');
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});

		it('should load cloud configs with default profile', function() {
			var cloudLoadStub = this.sandbox.stub(cloudConfigClient, 'load').returns(
				Promise.resolve({
					forEach(callback, aBoolValue) {
						callback('testUrl', 'http://www.default-local.com');
						callback('featureFlags.feature1', false);
						callback('featureFlags.feature2', false);
					}
				})
			);
			let options = {
				configPath: './test/config',
				activeProfiles: ['default'],
				level: 'debug'
			}
			return springCloudConfig.load(options).then((config) => {
				assert.deepEqual(config.name, 'the-application-name');
				assert.deepEqual(config.testUrl, 'http://www.default-local.com');
				assert.deepEqual(config.endpoint, 'http://localhost:8888');
				assert.deepEqual(config.featureFlags.feature1, false);
				assert.deepEqual(config.featureFlags.feature2, false);
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});

		it('should load cloud configs with dev profile', function() {
			var cloudLoadStub = this.sandbox.stub(cloudConfigClient, 'load').returns(
				Promise.resolve({
					forEach(callback, aBoolValue) {
						callback('testUrl', 'http://www.dev-cloud.com');
						callback('featureFlags.feature1', true);
						callback('featureFlags.feature2', false);
					}
				})
			);
			let options = {
				configPath: './test/config',
				activeProfiles: ['dev1'],
				level: 'debug'
			}
			return springCloudConfig.load(options).then((config) => {
				assert.deepEqual(config.name, 'the-application-name');
				assert.deepEqual(config.testUrl, 'http://www.dev-cloud.com');
				assert.deepEqual(config.endpoint, 'http://dev-config-server:8888');
				assert.deepEqual(config.featureFlags.feature1, true);
				assert.deepEqual(config.featureFlags.feature2, false);
			}, (error) => {
				assert.fail("Error", "Success", JSON.stringify(error.message));
			});
		});
	});

});