import { ethers } from "ethers";
import { DERSignature, UserOperation, WebAuthnSignature } from "../types/index";
export function parseDER(derBytes: Uint8Array): DERSignature {
  if (derBytes[0] !== 0x30) throw new Error("Invalid DER format: missing SEQUENCE");

  let offset = 2; // 跳过 SEQUENCE (0x30) 和总长度

  if (derBytes[offset] !== 0x02) throw new Error("Invalid DER format: missing INTEGER for r");
  const rLen = derBytes[offset + 1]; // r 的长度
  let r = derBytes.slice(offset + 2, offset + 2 + rLen);

  offset += 2 + rLen;

  if (derBytes[offset] !== 0x02) throw new Error("Invalid DER format: missing INTEGER for s");
  const sLen = derBytes[offset + 1]; // s 的长度
  let s = derBytes.slice(offset + 2, offset + 2 + sLen);

  if (r.length === 33 && r[0] === 0) {
    r = r.slice(1);
  }
  if (s.length === 33 && s[0] === 0) {
    s = s.slice(1);
  }

  return { r, s };
}

export function parsePublicKeyPoints(spkiBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(spkiBuffer);
  // 获取最后64字节的数据
  const PUBKEY_LENGTH = 64;
  const pubKeyBytes = bytes.slice(-PUBKEY_LENGTH);

  return {
    x: pubKeyBytes.slice(0, 32).buffer, // 前32字节为x坐标
    y: pubKeyBytes.slice(32).buffer, // 后32字节为y坐标
  };
}

export function arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const buffer = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    buffer[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return buffer.buffer;
}

export async function importPublicKey(publicKeyBytes: ArrayBuffer): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
      {
        name: "ECDSA",
        namedCurve: "P-256", // secp256r1
      },
      true,
      ["verify"],
    );
  } catch (error) {
    console.error("导入公钥失败:", error);
    throw error;
  }
}

export const getWebAuthnSignature = async (message: string): Promise<WebAuthnSignature> => {
  try {
    // 添加以太坊个人签名前缀
    const prefix = "\x19Ethereum Signed Message:\n";
    const messageBytes = ethers.toUtf8Bytes(message);
    const prefixedMessage = prefix + messageBytes.length + message;
    const prefixedMessageHash = ethers.keccak256(ethers.toUtf8Bytes(prefixedMessage));
    const challenge = ethers.toUtf8Bytes(prefixedMessageHash);
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

    // 获取签名数据并解析 DER 格式
    const signature = (assertion.response as AuthenticatorAssertionResponse).signature;
    const derSig = new Uint8Array(signature);
    const { r, s } = parseDER(derSig);

    const authenticatorData = (assertion.response as AuthenticatorAssertionResponse).authenticatorData;
    console.log("authenticatorData", authenticatorData);

    const clientDataJSON = (assertion.response as AuthenticatorAssertionResponse).clientDataJSON;
    const clientDataString = new TextDecoder().decode(clientDataJSON);

    return {
      authenticatorData: authenticatorData,
      clientDataJSON: clientDataJSON,
      // eslint-disable-next-line quotes
      challengeIndex: clientDataString.indexOf('"challenge"'),
      // eslint-disable-next-line quotes
      typeIndex: clientDataString.indexOf('"type"'),
      r: r,
      s: s,
    };
  } catch (error) {
    console.error("签名失败:", error);
    throw error;
  }
};
export const calculatePreVerificationGas = (userOp: UserOperation) => {
  // 基础值 = 21000
  let gas = 21000;

  // 序列化 userOp 相关字段
  const serialized = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "address", // sender
      "uint256", // nonce
      "bytes", // initCode
      "bytes", // callData
      "uint256", // callGasLimit
      "uint256", // verificationGasLimit
      "uint256", // preVerificationGas
      "uint256", // maxFeePerGas
      "uint256", // maxPriorityFeePerGas
      "bytes", // paymasterAndData
    ],
    [
      userOp.sender,
      userOp.nonce,
      userOp.initCode,
      userOp.callData,
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      userOp.paymasterAndData,
    ],
  );

  // 转换为字节数组以计算零字节和非零字节
  const bytes = ethers.getBytes(serialized);
  let numZeroBytes = 0;
  let numNonZeroBytes = 0;

  // 计算零字节和非零字节数量
  for (const byte of bytes) {
    if (byte === 0) {
      numZeroBytes++;
    } else {
      numNonZeroBytes++;
    }
  }

  // 计算总 gas
  gas += numZeroBytes * 4; // 零字节每个需要 4 gas
  gas += numNonZeroBytes * 16; // 非零字节每个需要 16 gas
  gas += 1900; // bundler 固定成本

  return gas;
};
