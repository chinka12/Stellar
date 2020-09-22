var EventSource = require("eventsource");
var StellarBase = require('stellar-base');
const baseUrl = "https://horizon-testnet.stellar.org"; //Testnet url
const axios = require("axios");
let stellar = axios.create({
  baseURL: baseUrl,
});

const eventListener = async(address) => {
  try {
    let valid = await isValidAddress(address);
    if(!valid){
      console.log('Invalid Address');
      return;
    }
    var es = new EventSource(
      `https://horizon-testnet.stellar.org/accounts/${address}/payments`,
    );
    es.onmessage = async function (message) {
      var result = message.data ? JSON.parse(message.data) : message;
      let txnDetails = await stellar.get(`/transactions/${result.transaction_hash.toLowerCase()}`);
      memo = txnDetails.data.memo;
      console.log("New payment:");
      result.memo = memo;
      console.log(result);
    };
    es.onerror = function (error) {
      if(error.message){
        console.log("An error occurred!",error);
      }
    };
  } catch (e) {
    console.log('error',e);
  }
}

const isValidAddress = async (address) => {
  return StellarBase.StrKey.isValidEd25519PublicKey(address);
};

eventListener("GB5V5UATD44KDWRNIEDXTJPQUSRGJX5DVZWTP7PV6WXPHLNLBOZNWXO3");