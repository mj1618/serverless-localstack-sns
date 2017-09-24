# serverless-localstack-sns
A serverless plugin to listen to localstack SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-localstack-sns.svg)](https://badge.fury.io/js/serverless-localstack-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

## Docs
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)

## Prerequisites

To use this plugin you will need an SNS endpoint. You can use your AWS account for SNS or you can use [localstack](https://github.com/localstack/localstack) with SNS running -
```bash
SERVICES=sns localstack start
```

## Installation

Install the plugin
```bash
npm install serverless-localstack-sns --save
```

Let serverless know about the plugin
```YAML
plugins:
  - serverless-localstack-sns
```

Configure the plugin with your localstack SNS endpoint and a free port the plugin can use.
```YAML
custom:
  localstack-sns:
    endpoint: http://localhost:4575
    port: 4002
    debug: false
```

## Usage

If you use [serverless-offline](https://github.com/dherault/serverless-offline) this plugin will start automatically.

However if you don't use serverless-offline you can start it manually with -
```bash
serverless localstacksns start
```