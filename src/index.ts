import {SNSAdapter, ISNSAdapter, ISNSAdapterConstructable} from "./sns-adapter";

class ServerlessLocalstackSns {
    private config: any;
    private serverless: any;
    public commands: object;
    private port: number;
    public hooks: object;
    private snsAdapter: ISNSAdapter;

    constructor(serverless: any, options: any) {
        this.config = serverless.service.custom["localstack-sns"] || {};
        this.serverless = serverless;
        this.port = this.config.port || 4002;
        this.commands = {
            localstacksns: {
                usage: "Listens to localstack SNS events and passes them to configured Lambda fns",
                lifecycleEvents: [
                    "start",
                ],
                start: {
                    lifecycleEvents: [
                        "init",
                        "end",
                    ],
                },
            },
        };

        this.hooks = {
            "before:offline:start:init": (SNSAdapterProvided?: ISNSAdapterConstructable) => this.start(SNSAdapterProvided),
            "after:offline:start:end": () => this.stop(),
            "localstacksns:start:init": (SNSAdapterProvided?: ISNSAdapterConstructable) => this.start(SNSAdapterProvided),
            "localstacksns:start:end": () => this.stop(),
        };
    }

    public async start(SNSAdapterProvided?: ISNSAdapterConstructable) {
        if (SNSAdapterProvided) {
            this.snsAdapter = new SNSAdapterProvided(this.config.endpoint, this.port, this.serverless.service.provider.region, (msg) => this.debug(msg));
        } else {
            this.snsAdapter = new SNSAdapter(this.config.endpoint, this.port, this.serverless.service.provider.region, (msg) => this.debug(msg));
        }
        await this.subscribeAll();
        this.snsAdapter.listen();
        return this.snsAdapter;
    }

    public async subscribeAll() {
        await this.unsubscribeAll();

        this.debug("subscribing");
        await Promise.all(Object.keys(this.serverless.service.functions).map(fnName => {
            const fn = this.serverless.service.functions[fnName];
            return Promise.all(fn.events.filter(event => event.sns != null).map(event => {
                return this.subscribe(fnName, event.sns);
            }));
        }));
    }

    public async unsubscribeAll() {
        const subs = await this.snsAdapter.listSubscriptions();
        await Promise.all(
            subs.Subscriptions
                .filter(sub => sub.Endpoint.indexOf(":" + this.port) > -1)
                .map(sub => this.snsAdapter.unsubscribe(sub.SubscriptionArn)));
    }

    public async subscribe(fnName, snsConfig) {
        this.debug("subscribe: " + fnName);
        // name = event.sns ||
        // arn = event.sns.arn ||
        // arn = event.sns.arn && topicName = event.sns.topicName
        const fn = this.serverless.service.functions[fnName];
        const handler = this.createHandler(fn);

        if (typeof snsConfig === "string") {
            this.log(`Creating topic: "${snsConfig}" for fn "${fnName}"`);
            const data = await this.snsAdapter.createTopic(fnName, fn, snsConfig);
            await this.snsAdapter.subscribe(fnName, handler, data.TopicArn);
        } else if (typeof snsConfig.arn === "string") {
            await this.snsAdapter.subscribe(fnName, handler, snsConfig.arn);
        } else {
            this.log("unsupported config: " + snsConfig);
            return Promise.resolve("unsupported config: " + snsConfig);
        }
    }

    public createHandler(fn) {
        this.debug(process.cwd());
        this.debug("require(" + process.cwd() + "/" + fn.handler.split(".")[0] + ")[" + fn.handler.split("/").pop().split(".")[1] + "]");
        const handler = require(process.cwd() + "/" + fn.handler.split(".")[0])[fn.handler.split("/").pop().split(".")[1]];
        return handler;
    }

    public log(msg, prefix = "INFO[serverless-localstack-sns]: ") {
        this.serverless.cli.log.call(this.serverless.cli, prefix + msg);
    }

    public debug(msg) {
        if (this.config.debug) {
            this.log(msg, "DEBUG[serverless-localstack-sns]: ");
        }
    }

    public stop() {
        this.debug("stopping plugin");
        this.snsAdapter.stop();
    }
}

module.exports = ServerlessLocalstackSns;
