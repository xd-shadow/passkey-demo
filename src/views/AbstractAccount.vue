<template>
  <div class="abstract-account">
    <h1>BNB Chain 抽象账户 Demo</h1>

    <div class="account-section">
      <button @click="createAccount">创建新账户</button>
      <div v-if="aaAddress" class="account-info">
        <h3>账户信息</h3>
        <p>地址: {{ aaAddress }}</p>
        <p>余额: {{ balance }} BNB</p>

        <div class="transaction-form">
          <h3>发送token</h3>
          <input v-model="tokenAddress" placeholder="token合约地址（不填则发送BNB）" class="token-input" />
          <input v-model="toAddress" placeholder="接收地址" />
          <input v-model="amount" placeholder="金额 (BNB)" type="number" />
          <button @click="sendTransaction">发送</button>
        </div>
        <!-- 发送AA账户中的ERC20代币 -->
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { ethers, AbiCoder, Interface } from "ethers";
import PassKeyAccountAbi from "@src/abis/PassKeyAccount.json";
import PassKeyAccountFactoryAbi from "@src/abis/PassKeyAccountFactory.json";
import ERC20Abi from "@src/abis/ERC20.json";

// 配置BNB Chain测试网
const BNB_TESTNET_RPC = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const FACTORY_ADDRESS = "0xC5eB87F2499326506De69Ec003DD275210a07c94";
// 账户相关状态
// 固定私钥 (仅用于测试环境)
const FIXED_PRIVATE_KEY = "0x6b911fd37cdf5c81d4c0adb1ab7fa822ed253ab0ad9aa18d77257c88b29b718e";
// const FIXED_PUBLIC_KEY =
//"0x042f58efa8f156c34bb24761d891ca2b7ebd613e6e944ce09c527029f490ac28054a679ae451e3a5541e36c1d0a68cd21c122f841770445962399911d54e0d276e";
const provider = new ethers.JsonRpcProvider(BNB_TESTNET_RPC);
const wallet = new ethers.Wallet(FIXED_PRIVATE_KEY, provider);

const FIXED_ADDRESS = "0x16bB6031CBF3a12B899aB99D96B64b7bbD719705"; // 账户地址、
const SALT = "0x00";

const aaAddress = ref("0x221e28020e74c309c20b16613c52c5e4aeea7708"); // 抽象账户地址
const balance = ref("0");
const tokenAddress = ref("0xc1448Db78D2BcFc61dA9519cA97B3239aE0999e0");
const toAddress = ref("0x16bB6031CBF3a12B899aB99D96B64b7bbD719705");
const amount = ref("0.001");

// 创建抽象账户
const createAccount = async () => {
  try {
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, PassKeyAccountFactoryAbi, wallet);

    const callRes = await factoryContract.createAccount.staticCall(
      [AbiCoder.defaultAbiCoder().encode(["address"], [FIXED_ADDRESS])],
      SALT,
    );
    if (callRes) {
      aaAddress.value = callRes;
    }

    const gasPrice = await provider.getFeeData();
    const tx = await factoryContract.createAccount(
      [AbiCoder.defaultAbiCoder().encode(["address"], [FIXED_ADDRESS])],
      SALT,
      {
        gasLimit: 1000000, // 手动设置 gas 限制
        gasPrice: gasPrice.gasPrice, // 使用网络当前 gas 价格
      },
    );
    const receipt = await tx.wait();
    getBalance();
    console.log("receipt", receipt);
  } catch (error: unknown) {
    console.error(error);
  }
};

// 获取余额
const getBalance = async () => {
  if (aaAddress.value) {
    const bal = await provider.getBalance(aaAddress.value);
    balance.value = ethers.formatEther(bal);
  }
};

// 发送交易(通过抽象账户)
const sendTransaction = async () => {
  if (!aaAddress.value || !toAddress.value || !amount.value) return;

  try {
    const accountContract = new ethers.Contract(aaAddress.value, PassKeyAccountAbi, wallet);

    if (tokenAddress.value) {
      // 发送ERC20代币
      // const tx = await tokenContract.transfer(aaAddress.value, ethers.parseUnits(amount.value, 18));
      const data = new Interface(ERC20Abi).encodeFunctionData("transfer", [
        toAddress.value,
        ethers.parseUnits(amount.value, 9),
      ]);
      console.log("data", data);

      const tx = await accountContract.execute(tokenAddress.value, "0", data);
      await tx.wait();
      console.log("tx", tx);
    } else {
      // 发送原生代币
      const tx = await accountContract.execute(toAddress.value, ethers.parseEther(amount.value), "0x");
      await tx.wait();
      console.log("tx", tx);
    }
  } catch (error: unknown) {
    console.error(error);
  }
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

.account-section {
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
