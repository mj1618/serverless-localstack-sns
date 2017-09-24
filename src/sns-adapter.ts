import {SNS} from "aws-sdk";
import * as express from "express";
import {ListSubscriptionsResponse, CreateTopicResponse} from "aws-sdk/clients/sns.d";
const app = express();

export type IDebug = (msg: any, stack?: any) => void;

export type SLSHandler = (event, ctx, cb) => void;

export interface ISNSAdapter {
    listSubscriptions(): Promise<ListSubscriptionsResponse>;
    unsubscribe(arn: string): Promise<void>;
    createTopic(fnName: string, fn: any, topicName: string): Promise<CreateTopicResponse>;
    subscribe(fnName: string, handler: SLSHandler, arn: string): Promise<void>;
    publish(topicArn: string, type: string, message: string): Promise<void>;
    listen();
    stop();
}
export interface ISNSAdapterConstructable {
    new(endpoint: string, port: number, region: string, debug: IDebug): ISNSAdapter;
}

export class SNSAdapter implements ISNSAdapter {
    private sns: SNS;
    private debug: IDebug;
    private port: number;
    private server: any;

    constructor(endpoint, port, region = "us-east-1", debug) {
        this.debug = debug;
        this.port = port;
        this.sns = new SNS({
            endpoint,
            region,
        });
    }

    public async listSubscriptions(): Promise<ListSubscriptionsResponse> {
        return await new Promise(res => {
                this.sns.listSubscriptions({}, (subsErr, subs) => {
                this.debug(JSON.stringify(subs));
                res(subs);
            });
        });
    }

    public async unsubscribe(arn) {
        this.debug("unsubscribing: " + arn);
        await new Promise(res => {
            this.sns.unsubscribe({
                SubscriptionArn: arn,
            }, (err, data) => {
                if (err) {
                    this.debug(err, err.stack);
                } else {
                    this.debug("unsubscribed: " + JSON.stringify(data));
                }
                res();
            });
        });
    }

    public async createTopic(fnName, fn, topicName) {
        return new Promise(res => this.sns.createTopic({ Name: topicName }, (err, data) => {
            if (err) {
                this.debug(err, err.stack);
            } else {
                this.debug("arn: " + JSON.stringify(data));
            }
            res(data);
        }));
    }

    public async subscribe(fnName, handler, arn) {
        const subscribeEndpoint = "http://localhost:" + this.port + "/" + fnName;
        this.debug("subscribe: " + fnName + " " + arn);
        this.debug("subscribeEndpoint: " + subscribeEndpoint);
        app.post("/" + fnName, (req, res) => {
            this.debug("calling fn: " + fnName + " 1");
            handler(req.body, {}, (data) => {
                res.send(data);
            });
        });
        const params = {
            Protocol: "http",
            TopicArn: arn,
            Endpoint: subscribeEndpoint,
        };

        await new Promise(res => {
            this.sns.subscribe(params, (err, data) => {
                if (err) {
                    this.debug(err, err.stack);
                } else {
                    this.debug(`successfully subscribed fn "${fnName}" to topic: "${arn}"`);
                }
                res();
            });
        });
    }

    public async publish(topicArn, type, message) {
        await new Promise(res => this.sns.publish({
            Message: "STRING_VALUE",
            MessageStructure: "json",
            TopicArn: topicArn,
        }, res));
    }

    public listen() {
        this.debug("starting to listen on port: " + this.port);
        this.server = app.listen(this.port);
    }

    public async stop() {
        if (this.server) {
            this.server.close();
        }
    }

}
