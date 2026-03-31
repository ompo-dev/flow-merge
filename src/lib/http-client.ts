import axios from "axios";
import { getPublicApiBaseUrl } from "@/lib/public-env";

export const apiClient = axios.create({
  baseURL: getPublicApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
