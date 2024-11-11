import {Message} from '@arco-design/web-vue';

export const checkResponse = (res) => {
  if (res.Response.Error) {
    console.log(res);
    Message.error(res.Response.Error.Message);
    return false;
  }
  return true;
};
