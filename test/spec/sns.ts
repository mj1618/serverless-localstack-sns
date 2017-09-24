const ServerlessLocalstackSns = require("../../src/index");
import {MockSns} from "../mock/sns";
import {expect} from "chai";
import handler = require("../mock/handler");
let plugin;

describe("test", () => {
    beforeEach(() => {
        handler.resetPongs();
    });
    afterEach(() => {
        plugin.stop();
    });
    it("should start on offline start", async () => {
        plugin = new ServerlessLocalstackSns(createServerless(), {});
        await plugin.hooks["before:offline:start:init"](MockSns);
        await plugin.hooks["after:offline:start:end"](MockSns);
    });

    it("should start on command start", async () => {
        plugin = new ServerlessLocalstackSns(createServerless(), {});
        await plugin.hooks["localstacksns:start:init"](MockSns);
        await plugin.hooks["localstacksns:start:end"](MockSns);
    });

    it("should send message", async () => {
        plugin = new ServerlessLocalstackSns(createServerless(), {});
        const snsAdapter = await plugin.start(MockSns);
        await snsAdapter.publish("arn:aws:sns:us-east-1:123456789012:test-topic", "hello");
        expect(handler.getPongs()).to.eq(2);
    });

    it("should error", async () => {
        plugin = new ServerlessLocalstackSns(createServerlessBad(), {});
        const snsAdapter = await plugin.start(MockSns);
        const err = await plugin.subscribe("badPong", createServerlessBad().service.functions.badPong );
        expect(err.indexOf("unsupported config:")).to.be.greaterThan(-1);
        await snsAdapter.publish("arn:aws:sns:us-east-1:123456789012:test-topic", "hello");
        expect(handler.getPongs()).to.eq(0);
    });
});

const createServerless = () => {
    return {
        service: {
            custom: {
                "localstack-sns": {
                    endpoint: "http://localhost:4575",
                    debug: true,
                    port: 4003,
                },
            },
            provider: {
                region: "us-east-1",
            },
            functions: {
                pong: {
                    handler: "test/mock/handler.pongHandler",
                    events: [{
                        sns: "test-topic",
                    }],
                },
                pong2: {
                    handler: "test/mock/handler.pongHandler",
                    events: [{
                        sns: {
                            arn: "arn:aws:sns:us-east-1:123456789012:test-topic",
                        },
                    }],
                },
            },
        },
        cli: {
            log: (data) => {
                // noop for log
                // console.log(data);
            },
        },
    };
};

const createServerlessBad = () => {
    return {
        service: {
            custom: {
                "localstack-sns": {
                    endpoint: "http://localhost:4575",
                    debug: true,
                    port: 4002,
                },
            },
            provider: {
                region: "us-east-1",
            },
            functions: {
                badPong: {
                    handler: "test/mock/handler.pongHandler",
                    events: [{
                        sns: {
                            topicArn: "arn:aws:sns:us-east-1:123456789012:test-topic",
                        },
                    }],
                },
            },
        },
        cli: {
            log: (data) => {
                // noop for log
                // console.log(data);
            },
        },
    };
};
