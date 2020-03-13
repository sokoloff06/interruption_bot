# interruption_bot
Service Interruption is a Slack App that helps R&D to submit an internal service interruption alerts always in the same format which makes it more readable and informative to the rest of the company. Feel free to refer to this Guru to learn more: https://app.getguru.com/card/cbXAqgAi/Service-Interruption-Slack-App

# Slack Service Interruption Submission Bot
* Simple Node.js app which when given a slack command (e.g., `/service-interruption-report `) displays a [slack dialog](https://api.slack.com/dialogs) to collect a description of the service interruption incident and creates a post describing the incident with data collected from the dialog.

# Set up

* Put relevant *host URL* under the slack application in the following sections (see screenshots attached)
    * Interactive Components -> Request URL
    * Slash Commands -> /report -> Request URL

* When deploying, make sure to set up environment (in .env file when running locally or in AWS UI when running on lambda) variables for:
    * APP_TOKEN
    * BOT_TOKEN
    * CHANNEL_ID (service interruption channel ID)
    * CLIENT_ID
    * CLIENT_SECRET

* Make sure to change the value of `const DEBUG` to `true` when running locally ir to `false` when running on lambda