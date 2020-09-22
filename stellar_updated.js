var StellarSdk = require("stellar-sdk");
var StellarBase = require('stellar-base');
const baseUrl = "https://horizon-testnet.stellar.org"; //Testnet url
// const baseUrl = "https://horizon.stellar.org"; //Mainnet Url
const server = new StellarSdk.Server(baseUrl);
const _ = require('lodash');
const axios = require("axios");
let stellar = axios.create({
  baseURL: baseUrl,
});

const generateAddress = async () => {
  try {
    const pair = StellarSdk.Keypair.random();
    pair.secret();
    pair.publicKey();
    return {
      address: pair.publicKey().toString(),
      secret: pair.secret().toString(),
      memo: Date.now().toString()
    };
  } catch (e) {
    return e.message;
  }
};

const isValidAddress = async (address) => {
  return StellarBase.StrKey.isValidEd25519PublicKey(address);
};

const isValidSecret = async (secret) => {
  return StellarBase.StrKey.isValidEd25519SecretSeed(secret);
};

const getBalance = async (address) => {
  try {
    let isValid = await isValidAddress(address);
    if (!isValid) {
      return "Invalid Address";
    }
    const account = await server.loadAccount(address);
    let i = _.findIndex(account.balances, ['asset_type', 'native']);
    return {
      exists: true,
      balance: account.balances[i].balance
    };
  } catch (e) {
    if (e.response.status == 404) {
      return {
        exists: false,
        balance: 0
      };
    } else {
      return e.message;
    }
  }
};

const transactionWrapper = async (transactionDetails) => {
  try {
    let txnDetails = await stellar.get(`/transactions/${transactionDetails.transaction_hash.toLowerCase()}`);
    txnDetails = txnDetails.data;
    let amount = transactionDetails.amount;
    let startingBalance = transactionDetails.starting_balance;
    let to = transactionDetails.to;
    let account = transactionDetails.account;
    let transaction = {
      transactionHash: transactionDetails.transaction_hash,
      senderAddress: transactionDetails.source_account,
      destinationAddress: to? to: account,
      amount: amount? amount: startingBalance,
      type: transactionDetails.type,
      memo: (txnDetails.memo ? txnDetails.memo : ""),
      txnFee: Number(txnDetails.fee_charged)/10**7,
      sequence: txnDetails.source_account_sequence,
      status: transactionDetails.transaction_successful,
      timestamp: new Date(transactionDetails.created_at).getTime() / 1000.0,
      rawTxnObj: JSON.stringify(transactionDetails)
    };
    return transaction;
  } catch (e) {
    console.log('e',e);
    return {};
  }
};

const getTransactionDetails = async (transactionHash) => {
  try {
    let response = await stellar.get(`/transactions/${transactionHash.toLowerCase()}/operations`);
    response = response.data._embedded.records[0];
    // console.log(transactionWrapper(response));
    return transactionWrapper(response);
  } catch (e) {
    if (e.response.data.status == 400 && e.response.data.extras.invalid_field == "tx_id") {
      return "Invalid transactionHash";
    }
    return e.message;
  }
};

const validateInput = async (input) => {
  let {
    secret,
    destination,
    amount,
    memo
  } = input;
  let errors = [];
  let validSecret = await isValidSecret(secret);
  let validAddress = await isValidAddress(destination);
  if (!validSecret) {
    errors.push("Invalid Secret");
  }
  if (!validAddress) {
    errors.push("Invalid Destination");
  }
  if (Number(amount) < 0) {
    errors.push("Invalid Amount");
  }
  if(memo){
    if(memo.toString().length < 13){
      errors.push("Invalid Memo");
    }
  }else {
    errors.push("Invalid Memo");
  }
  return errors;
};

const sendCoin = async (input) => {
  try {
    let {
      secret,
      destination,
      amount,
      memo
    } = input;
    let errors = await validateInput(input);
    if (errors.length > 0) {
      console.log('errors',errors);
      return errors;
    }
    const source = StellarSdk.Keypair.fromSecret(secret);
    // console.log('address=',source.publicKey());
    let sourceBalance = await getBalance(source.publicKey().toString());
    if (!sourceBalance.exists) {
      console.log("Account does not exist");
      return "Account does not exist"
    }
    if (Number(sourceBalance.balance) < Number(amount)) {
      console.log("Insufficient Funds");
      return "Insufficient Funds"
    }
    let destinationBalance = await getBalance(destination);
    let accountDetails = await server.accounts().accountId(source.publicKey().toString()).call();
    let sequence = accountDetails.sequence;
    // console.log('sequence=',sequence);
    let account = new StellarSdk.Account(source.publicKey().toString(), sequence);
    let transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    });
    if (destinationBalance.exists) {
      transaction.addOperation(StellarSdk.Operation.payment({
        destination: destination,
        asset: StellarSdk.Asset.native(),
        amount: `${amount}`
      })).setTimeout(80);
    } else {
      transaction.addOperation(StellarSdk.Operation.createAccount({
        destination: destination,
        startingBalance: `${amount}`,
      })).setTimeout(80);
    }
    if (memo) {
      transaction.addMemo(StellarSdk.Memo.text(memo.toString()));
    }
    transaction = await transaction.build();
    transaction.sign(StellarSdk.Keypair.fromSecret(source.secret()));
    let hash = await server.submitTransaction(transaction);
    console.log('transactionHash',hash.id);
    return hash.id;
  } catch (e) {
    console.log('e', e);
    if (e.response.data.extras.result_codes.operations[0] == 'op_underfunded') {
      console.log("Insufficient Funds");
      return "Insufficient Funds"
    }
    console.log('res=', e.response.data.extras);
    return e.message;
  }
};


// sendCoin({
//   secret: "SAV76USXIJOBMEQXPANUOQM6F5LIOTLPDIDVRJBFFE2MDJXG24TAPUU7",
//   destination: "GA5ED6ZTMRPIKFY5WXYTYTSWV4OU25D4JUSKLGNI7R5KYOZYEXQHDHYL",
//   amount: "0.1",
//   memo: "123648655415 465"
// });
// console.log('StellarSdk.Networks',StellarSdk.Networks);

let test = async()=>{
  let data = await getTransactionDetails("cbd7b1aa60d81980ad4d8d835cd5aeda27bda3d1d2e72f78d8b933145267f439");
  console.log('data=',data);
};
test();
// console.log(generateAddress());
// getBalance("GABMUPGBETYJ6ZUL6CKHACV3WLWVMW4CDY6NV374BBMIHO3EUHMIV6W7");