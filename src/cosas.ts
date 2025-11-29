            import { Client, ContentTypeId } from '@xmtp/browser-sdk';
            // import { Client, ContentTypeId } from '@xmtp/xmtp-js';
            window.Client = Client;
            window.ContentTypeId = ContentTypeId;


            import { ReadReceiptCodec } from '@xmtp/content-type-read-receipt';
            window.ReadReceiptCodec = ReadReceiptCodec;



const allConversations = await client.conversations.list({
  consentStates: [ConsentState.Allowed],
});
const allGroups = await client.conversations.listGroups({
  consentStates: [ConsentState.Allowed],
});
const allDms = await client.conversations.listDms({
  consentStates: [ConsentState.Allowed],
});


formatTimestampForContactList(exmsg[1].sentAtNs)

currentConversation.peerInboxid = await currentConversation.peerInboxId()



let inbxid = m.senderInboxId
                 const stts = await chatwalletxmtp.preferences.inboxStateFromInboxIds([inbxid], true)
                 const senderAddress = stts[0].identifiers[0].identifier;
                 console.warn('SENDER ADDRESS:', senderAddress)



                    const isChatOpen = chatView.classList.contains('active') &&
                    currentConversation &&
                    chatwalletxmtp.inboxId === message.senderInboxId;
                    
                                console.log('currentConversation.addedByInboxId',currentConversation.addedByInboxId)
                                console.log('chatwalletxmtp.inboxId',chatwalletxmtp.inboxId)
                                console.log('message.senderInboxId',message.senderInboxId)
                        console.warn('isChatOpen',isChatOpen)


                        // ----
las formas correctas son 
currentConversation.addedByInboxId (en vez de currentConversation.inboxId )
y message.senderInboxId (en vez de message.conversation.inboxId)

currentConversation.metadata.
currentConversation.metadata.creatorInboxId



"ee42485834186d620b038fbe242b2164c53c1763973f1b72a09933a1d73e0428"