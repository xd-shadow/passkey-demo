import axios from "axios";
const origin = "";

export const request = axios.create({
  baseURL: origin,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});
