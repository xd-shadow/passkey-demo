<template>
  <div class="abstract-account">
    <h1>BNB Chain 抽象账户 Demo</h1>
    <section>
      <h3>注册passkey</h3>
      <button @click="registerPasskey">注册</button>
      <p v-if="passkeyPublicKey">{{ arrayBufferToHex(passkeyPublicKey) }}</p>
    </section>

    <section class="account-section">
      <button @click="createAccount">创建新账户</button>
      <div v-if="aaAddress" class="account-info">
        <h3>账户信息</h3>
        <p>aa地址: {{ aaAddress }}</p>
        <!-- <p>余额: {{ balance }} BNB</p> -->

        <div class="transaction-form">
          <h3>发送token</h3>
          <input v-model="tokenAddress" placeholder="token合约地址（不填则发送BNB）" class="token-input" />
          <input v-model="toAddress" placeholder="接收地址" />
          <input v-model="amount" placeholder="金额 (BNB)" type="number" />
          <button @click="sendTransaction">发送</button>
        </div>
        <!-- 发送AA账户中的ERC20代币 -->
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { ethers, AbiCoder, Interface } from "ethers";
import PassKeyAccountAbi from "@src/abis/PassKeyAccount.json";
import PassKeyAccountFactoryAbi from "@src/abis/PassKeyAccountFactory.json";
import ERC20Abi from "@src/abis/ERC20.json";
import { arrayBufferToHex, parsePublicKeyPoints, hexToArrayBuffer, getWebAuthnSignature } from "@src/utils";

// 配置BNB Chain测试网
const BNB_TESTNET_RPC = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const FACTORY_ADDRESS = "0xC5eB87F2499326506De69Ec003DD275210a07c94";
// 账户相关状态
// 固定私钥 (仅用于测试环境)
const FIXED_PRIVATE_KEY = "0x6b911fd37cdf5c81d4c0adb1ab7fa822ed253ab0ad9aa18d77257c88b29b718e";

const provider = new ethers.JsonRpcProvider(BNB_TESTNET_RPC);
const wallet = new ethers.Wallet(FIXED_PRIVATE_KEY, provider);

const FIXED_ADDRESS = "0x16bB6031CBF3a12B899aB99D96B64b7bbD719705"; // 账户地址、
const SALT = "0x00";

//passkey相关
const KEY_NAME = "test1";

// 响应式变量
const aaAddress = ref(localStorage.getItem("aaAddress")); // 抽象账户地址
// const balance = ref("0");
const tokenAddress = ref("0xc1448Db78D2BcFc61dA9519cA97B3239aE0999e0");
const toAddress = ref("0x16bB6031CBF3a12B899aB99D96B64b7bbD719705");
const amount = ref("0.0001");
const passkeyPublicKey = ref<ArrayBuffer | null>(
  localStorage.getItem("publicKey") ? hexToArrayBuffer(localStorage.getItem("publicKey")!) : null,
);

const registerPasskey = async () => {
  try {
    // 生成用户 ID
    const userIdArray = new TextEncoder().encode(KEY_NAME);
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
        name: KEY_NAME,
        displayName: KEY_NAME,
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
    passkeyPublicKey.value = publicKey;
    localStorage.setItem("publicKey", arrayBufferToHex(publicKey));
    console.log("Public Key (hex):", arrayBufferToHex(publicKey));
    // const points = parsePublicKeyPoints(arrayBufferToHex(publicKey));
    // console.log("x:", points.x);
    // console.log("y:", points.y);
    // const publicKeyAlgorithm = response.getPublicKeyAlgorithm();
    // console.log("Public Key Algorithm:", publicKeyAlgorithm);
    // console.log("PassKey registered successfully!");
  } catch (error) {
    console.error(error);
  }
};

// 创建抽象账户
const createAccount = async () => {
  if (!passkeyPublicKey.value) {
    console.error("请先注册Passkey");
    return;
  }
  try {
    // const { x, y } = parsePublicKeyPoints(passkeyPublicKey.value);
    const xy = new Uint8Array(passkeyPublicKey.value).slice(-64);
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, PassKeyAccountFactoryAbi, wallet);

    const callRes = await factoryContract.createAccount.staticCall(
      // [AbiCoder.defaultAbiCoder().encode(["address"], [FIXED_ADDRESS])],
      [xy],
      SALT,
    );
    console.log(callRes);

    if (callRes) {
      aaAddress.value = callRes;
    }

    const gasPrice = await provider.getFeeData();
    const tx = await factoryContract.createAccount(
      // [AbiCoder.defaultAbiCoder().encode(["address"], [FIXED_ADDRESS])],
      [xy],
      SALT,
      {
        gasLimit: 1000000,
        gasPrice: gasPrice.gasPrice,
      },
    );
    const receipt = await tx.wait();
    localStorage.setItem("aaAddress", callRes);
    // getBalance();
    console.log("receipt", receipt);
  } catch (error: unknown) {
    console.error(error);
  }
};

// 获取余额
// const getBalance = async () => {
//   if (aaAddress.value) {
//     const bal = await provider.getBalance(aaAddress.value);
//     balance.value = ethers.formatEther(bal);
//   }
// };

// 发送交易(通过抽象账户)
const sendTransaction = async () => {
  if (!aaAddress.value || !toAddress.value || !amount.value) return;

  const accountContract = new ethers.Contract(aaAddress.value, PassKeyAccountAbi, wallet);

  let targetAddress, value, data;
  if (tokenAddress.value) {
    // 发送ERC20代币
    targetAddress = tokenAddress.value;
    value = "0";
    data = new Interface(ERC20Abi).encodeFunctionData("transfer", [
      toAddress.value,
      ethers.parseUnits(amount.value, 9),
    ]);

    // const tx = await accountContract.execute(tokenAddress.value, "0", data);
    // await tx.wait();
  } else {
    // 发送原生代币
    // const tx = await accountContract.execute(toAddress.value, ethers.parseEther(amount.value), "0x");
    // await tx.wait();
    // console.log("tx", tx);
    targetAddress = toAddress.value;
    value = ethers.parseEther(amount.value);
    data = "0x00";
  }
  console.log("data", data);
  const nonce = await accountContract.getNonce();
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits("10", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei");
  const userOp = {
    sender: aaAddress.value,
    nonce: nonce,
    initCode: "0x",
    callData: accountContract.interface.encodeFunctionData("execute", [targetAddress, value, data]),
    callGasLimit: "0x55555",
    verificationGasLimit: "0x55555",
    preVerificationGas: "0x55555",
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: "0x",
  };
  //通过sha256计算hash
  console.log("userOp", userOp);
  // 确保所有参数都已转换为十六进制字符串
  const encodedUserOp = {
    ...userOp,
    nonce: ethers.toBeHex(userOp.nonce),
    callGasLimit: ethers.toBeHex(userOp.callGasLimit),
    verificationGasLimit: ethers.toBeHex(userOp.verificationGasLimit),
    preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
  };

  const userOpHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes", "bytes", "uint256", "uint256", "uint256", "uint256", "bytes", "bytes", "bytes"],
      [
        encodedUserOp.sender,
        encodedUserOp.nonce,
        encodedUserOp.initCode,
        encodedUserOp.callData,
        encodedUserOp.callGasLimit,
        encodedUserOp.verificationGasLimit,
        encodedUserOp.preVerificationGas,
        encodedUserOp.maxFeePerGas,
        encodedUserOp.maxPriorityFeePerGas,
        encodedUserOp.paymasterAndData,
        encodedUserOp.signature,
      ],
    ),
  );
  console.log("userOpHash", userOpHash);

  const { r, s } = await getWebAuthnSignature(userOpHash);
  console.log("r", r);
  console.log("s", s);

  //TODO: 发送签名的userOp
};
</script>

<style scoped>
.abstract-account {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px;
  background-color: #ffffff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

section {
  margin-top: 30px;
  padding: 20px;
  border: 2px solid #f0b90b;
  border-radius: 12px;
  background-color: #fefefe;
}

button {
  margin: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #f0b90b, #e6a908);
  color: #000;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(240, 185, 11, 0.3);
}

input {
  padding: 12px;
  margin: 8px 0;
  width: 100%;
  max-width: 400px;
  border: 2px solid #eee;
  border-radius: 6px;
  transition: border-color 0.3s ease;
}

input:focus {
  outline: none;
  border-color: #f0b90b;
}

input::placeholder {
  color: #999;
  font-size: 0.9em;
}

.token-input {
  margin-bottom: 15px;
}

.account-info {
  margin-top: 25px;
}

.account-info h3 {
  color: #333;
  margin-bottom: 15px;
  font-size: 1.2em;
}

.account-info p {
  color: #666;
  margin: 10px 0;
}

.transaction-form {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

section {
  margin: 15px 0;
}

section p {
  margin-top: 5px;
  color: #888;
  font-size: 0.9em;
}
</style>
