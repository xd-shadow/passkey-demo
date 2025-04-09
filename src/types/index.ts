// 类型定义
export type DERSignature = {
  r: Uint8Array;
  s: Uint8Array;
};

export interface UserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: bigint | string;
  maxPriorityFeePerGas: bigint | string;
  paymasterAndData: string;
  signature?: string;
}

export interface WebAuthnSignature {
  authenticatorData: ArrayBuffer;
  clientDataJSON: ArrayBuffer;
  challengeIndex: number;
  typeIndex: number;
  r: Uint8Array;
  s: Uint8Array;
}
