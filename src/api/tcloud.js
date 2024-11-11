import CryptoJS from 'crypto-js';
import axios from 'axios';
import globalContext from '../context';

const sha256 = (message, secret, encoding) => {
  return CryptoJS.HmacSHA256(message, secret);
};

const getHash = (message, encoding) => {
  return CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
};

const getDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + date.getUTCDate()).slice(-2);
  return `${year}-${month}-${day}`;
};

const request = (secretID, secretKey, action, version, payload, method) => {
  const host = 'teo.tencentcloudapi.com';
  const service = 'teo';
  const timestamp = parseInt(String(new Date().getTime() / 1000));
  const date = getDate(timestamp);
  const signedHeaders = 'content-type;host';
  const hashedRequestPayload = getHash(payload);
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = 'content-type:application/json; charset=utf-8\n' + 'host:' + host + '\n';
  const canonicalRequest =
    method +
    '\n' +
    canonicalUri +
    '\n' +
    canonicalQueryString +
    '\n' +
    canonicalHeaders +
    '\n' +
    signedHeaders +
    '\n' +
    hashedRequestPayload;
  const algorithm = 'TC3-HMAC-SHA256';
  const hashedCanonicalRequest = getHash(canonicalRequest);
  const credentialScope = date + '/' + service + '/' + 'tc3_request';
  const stringToSign =
    algorithm +
    '\n' +
    timestamp +
    '\n' +
    credentialScope +
    '\n' +
    hashedCanonicalRequest;
  const kDate = sha256(date, 'TC3' + secretKey);
  const kService = sha256(service, kDate);
  const kSigning = sha256('tc3_request', kService);
  const signature = sha256(stringToSign, kSigning, 'hex');
  const authorization =
    algorithm +
    ' ' +
    'Credential=' +
    secretID +
    '/' +
    credentialScope +
    ', ' +
    'SignedHeaders=' +
    signedHeaders +
    ', ' +
    'Signature=' +
    signature;
  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json; charset=utf-8',
    'X-TC-Action': action,
    'X-TC-Timestamp': timestamp,
    'X-TC-Version': version,
  };
  return new Promise((resolve, reject) => {
    axios.request({
      method: method,
      url: globalContext.teoProxyUrl || `https://${host}`,
      headers: headers,
      data: JSON.parse(payload),
    }).then(
        (res) => resolve(res),
        (err) => reject(err),
    );
  });
};

export const describeZonesAPI = (secretID, secretKey, payload) => {
  return request(secretID, secretKey, 'DescribeZones', '2022-09-01', JSON.stringify(payload), 'POST');
};

export const createPurgeTaskAPI = (secretID, secretKey, payload) => {
  return request(secretID, secretKey, 'CreatePurgeTask', '2022-09-01', JSON.stringify(payload), 'POST');
};

export const describePurgeTasksAPI = (secretID, secretKey, payload) => {
  return request(secretID, secretKey, 'DescribePurgeTasks', '2022-09-01', JSON.stringify(payload), 'POST');
};
