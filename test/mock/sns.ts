import {SNS} from "aws-sdk";
import {ISNSAdapter, IDebug} from "../../src/sns-adapter";
import {Topic, TopicsList, Subscription, ListSubscriptionsResponse, CreateTopicResponse} from "aws-sdk/clients/sns.d";
import fetch from "node-fetch";
import * as express from "express";

export class MockSns implements ISNSAdapter {
    private topics: TopicsList;
    private subscriptions: Subscription[];
    private debug: IDebug;
    private port: number;
    private server: any;
    private app: any;

    constructor(endpoint, port, region = "us-east-1", debug) {
        this.debug = debug;
        this.topics = [];
        this.port = port;
        this.subscriptions = [];
        this.app = express();
    }

    public async listSubscriptions() {
        return Promise.resolve({
            Subscriptions: this.subscriptions,
        });
    }

    public async unsubscribe(arn) {
        this.debug(JSON.stringify(this.subscriptions));
        this.debug("unsubscribing: " + arn);
        this.subscriptions = this.subscriptions.filter(sub => sub.SubscriptionArn !== arn);
        return Promise.resolve();
    }

    public async createTopic(fnName, fn, topicName) {
        const topic = {
            TopicArn: "arn:aws:sns:us-east-1:123456789012:" + topicName,
        };
        this.topics.push(topic);
        return Promise.resolve(topic);
    }

    public async subscribe(fnName, handler, arn) {
        const subscribeEndpoint = "http://localhost:" + this.port + "/" + fnName;
        this.debug("subscribe: " + fnName + " " + arn);
        this.debug("subscribeEndpoint: " + subscribeEndpoint);
        this.app.post("/" + fnName, (req, res) => {
            this.debug("calling fn: " + fnName + " 1");
            this.debug(JSON.stringify(this.subscriptions));
            if (this.subscriptions.some(sub => sub.Endpoint === subscribeEndpoint)) {
                handler(req.body, {}, (data) => {
                    res.send(data);
                });
            }
        });
        this.subscriptions.push({
            SubscriptionArn: arn + ":" + Math.floor(Math.random() * (1000000 - 1)),
            Protocol: "http",
            TopicArn: arn,
            Endpoint: subscribeEndpoint,
        });

        return Promise.resolve();
    }

    public async publish(topicArn, message) {
        await Promise.all(this.subscriptions.filter(sub => sub.TopicArn === topicArn).map(sub => {
            return fetch(sub.Endpoint, { method: "POST", body: message })
                .then(res => res.json())
                .then(res => this.debug(res));
        }));
    }

    public async listen() {
        this.server = this.app.listen(this.port);
    }

    public async stop() {
        if (this.server) {
            this.server.close();
        }
        this.subscriptions = [];
    }

}
