export interface TokenInfo {
    name?: string;
    symbol: string;
    address: string;
    decimals: number;
    isStableCoin?: boolean;
}

export interface BaseInfo {
    name?: string;
    symbol: string;
    address: string; // for chainlink base is ZERO address
    decimals: number; // for chainlink base is 0
}
