const { PinpointSMSVoiceV2Client, SendTextMessageCommand, SendTextMessageCommandOutput } = require("@aws-sdk/client-pinpoint-sms-voice-v2");

const client = new PinpointSMSVoiceV2Client({})

/** @typedef {{ MessageBody: string, DryRun: boolean | undefined}} UberEatsSendTextMessageCommandInput */

class UberEatsSendTextMessageCommand extends SendTextMessageCommand {
  /**
   * Creates an AWS Pinpoint SMS Voice V2 SendTextMessageCommand for
   * sending an SMS message, configured for the Uber Eats Button.
   * @param {UberEatsSendTextMessageCommandInput} input 
   */
  constructor(input) {
    super({
      DestinationPhoneNumber: process.env.AWS_DESTINATION_PHONE_NUMBER,
      OriginationIdentity: process.env.AWS_ORIGINATION_POOL_ID,
      MessageBody: input.MessageBody,
      MessageType: 'TRANSACTIONAL',
      DryRun: input.DryRun,
    })
  }
}

/**
 * Calls the AWS Pinpoint SMS Voice V2 API to send a message to the
 * configured phone number.
 * @param {string} message The body of the text message.
 * @param {boolean | undefined} dryRun When set to true, the message is checked and validated, but isn't sent to the end recipient.
 * @returns {Promise<SendTextMessageCommandOutput>} A Promise that resolves to an output with the message metadata.
 */
const sendSMSMessage = async (message, dryRun) => {
  return new Promise((res, rej) => {
    const command = new UberEatsSendTextMessageCommand({
      MessageBody: message,
      DryRun: dryRun
    })
  
    client
      .send(command)
      .then(res)
      .catch(rej);
  })
}

module.exports =  { 
  sendSMSMessage
}