<template>
  <h1>PassKey Demo</h1>
  <div>
    <h2>Register</h2>
    <input v-model="username" type="text" placeholder="Enter username" />
    <button @click="registerPasskey">Register PassKey</button>
  </div>

  <div>
    <h2>Sign Data</h2>
    <input v-model="dataToSign" type="text" placeholder="Enter data to sign" />
    <button @click="signData">Sign Data</button>
  </div>
</template>

<script lang="ts" setup>
/* eslint-disable quotes */
import { ref } from "vue";
import { parseDER, arrayBufferToHex, importPublicKey, parsePublicKeyPoints } from "@src/utils";

type WebAuthnInfo = {
  authenticatorData: string;
  clientDataJSON: string;
  challengeIndex: number;
  typeIndex: number;
  r: string;
  s: string;
};

// 响应式变量
const username = ref<string>("t1");
const dataToSign = ref<string>("111111");
let pkBytes: ArrayBuffer | undefined;

async function registerPasskey(): Promise<void> {
  if (!username.value) {
    alert("Please enter a username");
    return;
  }

  try {
    // 生成用户 ID
    const userIdArray = new TextEncoder().encode(username.value);
    // 生成挑战值并转换为 ArrayBuffer
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyCredentialCreationOptions = {
      challenge: challenge.buffer,
      rp: {
        name: "PassKey Demo",
        id: "localhost",
      },
      user: {
        id: userIdArray,
        name: username.value,
        displayName: username.value,
      },
      pubKeyCredParams: [
        {
          type: "public-key",
          alg: -7, // ES256
        },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60000,
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions as any,
    })) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAttestationResponse;

    // 从证书中获取公钥
    const publicKey = response.getPublicKey();
    if (!publicKey) {
      throw new Error("Failed to get public key");
    }
    pkBytes = publicKey;
    const publicKeyAlgorithm = response.getPublicKeyAlgorithm();

    console.log("Public Key (hex):", arrayBufferToHex(pkBytes!));
    const points = parsePublicKeyPoints(pkBytes);
    console.log("x:", points.x);
    console.log("y:", points.y);

    console.log("Public Key Algorithm:", publicKeyAlgorithm);
    console.log("PassKey registered successfully!");
  } catch (error) {
    console.error("Error registering PassKey:", error);
  }
}

async function signData(): Promise<void> {
  if (!pkBytes) {
    console.log("请先注册 PassKey 获取公钥");
    return;
  }
  if (!dataToSign.value) {
    console.log("请输入要签名的数据");
    return;
  }

  try {
    // 生成随机挑战值并与签名数据组合
    const randomPart = crypto.getRandomValues(new Uint8Array(32));
    const dataPart = new TextEncoder().encode(dataToSign.value);
    const challenge = new Uint8Array(randomPart.length + dataPart.length);
    challenge.set(randomPart);
    challenge.set(dataPart, randomPart.length);
    console.log("Combined Challenge:", arrayBufferToHex(challenge.buffer));

    const publicKeyCredentialRequestOptions = {
      challenge: challenge,
      rpId: "localhost",
      userVerification: "required" as const,
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;
    if (!assertion) {
      throw new Error("Failed to get assertion");
    }

    // 获取签名数据 - 需要处理 DER 编码的签名
    const signature = (assertion.response as AuthenticatorAssertionResponse).signature;
    console.log("signature", signature);
    // console.log("signature hex:", arrayBufferToHex(signature));

    // 从DER格式中提取原始签名 (r,s)
    const derSig = new Uint8Array(signature);
    console.log("derSig", derSig);
    let { r, s } = parseDER(derSig);
    console.log("r", r);
    console.log("s", s);

    // 组合为原始签名格式
    const rawSignature = new Uint8Array(r.length + s.length);
    rawSignature.set(r);
    rawSignature.set(s, r.length);

    // 获取认证数据和客户端数据
    const authenticatorData = (assertion.response as AuthenticatorAssertionResponse).authenticatorData;
    const clientDataJSON = (assertion.response as AuthenticatorAssertionResponse).clientDataJSON;
    const clientDataHash = await crypto.subtle.digest("SHA-256", clientDataJSON);
    console.log("clientDataJSON", arrayBufferToHex(clientDataJSON));

    // 构造验签数据
    const verifyData = new Uint8Array(authenticatorData.byteLength + clientDataHash.byteLength);
    verifyData.set(new Uint8Array(authenticatorData), 0);
    verifyData.set(new Uint8Array(clientDataHash), authenticatorData.byteLength);

    // 导入公钥
    const publicKey = await importPublicKey(pkBytes);

    // const clientDataObj = JSON.parse(new TextDecoder().decode(clientDataJSON));
    const clientDataString = new TextDecoder().decode(clientDataJSON);

    //将来调合约用
    const webauthn: WebAuthnInfo = {
      authenticatorData: arrayBufferToHex(authenticatorData),
      clientDataJSON: arrayBufferToHex(clientDataJSON),
      challengeIndex: clientDataString.indexOf('"challenge"'),
      typeIndex: clientDataString.indexOf('"type"'),
      r: arrayBufferToHex(r),
      s: arrayBufferToHex(s),
    };
    console.log("webauthn info: ", webauthn);

    const isValid = await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      publicKey,
      rawSignature.buffer,
      // signature,
      verifyData.buffer,
    );

    console.log("验签结果:", isValid);
  } catch (error: any) {
    console.error("错误:", error);
  }
}
</script>

<style lang="scss" scoped>
body {
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.error-message {
  color: red;
  margin-top: 10px;
}
</style>
