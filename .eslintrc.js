// eslint-disable-next-line no-undef
module.exports = {
  env: {
    browser: true,
    es2021: true,
    "vue/setup-compiler-macros": true,
  },
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-essential",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "plugin:prettier/recommended",
  ],
  parserOptions: {
    ecmaVersion: 13,
    parser: "@typescript-eslint/parser",
    sourceType: "module",
  },
  plugins: ["vue", "@typescript-eslint"],
  rules: {
    // indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-inferrable-types": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "no-undef": ["error", { typeof: true }],
  },
  parser: "vue-eslint-parser",
  globals: {
    // 添加 Web Authentication API 相关的全局变量
    PublicKeyCredential: "readonly",
    CredentialsContainer: "readonly",
    AuthenticatorResponse: "readonly",
    AuthenticatorAttestationResponse: "readonly",
    AuthenticatorAssertionResponse: "readonly",
  },
};
