import sdk from "~/sdk";

const { Token, ChainId } = sdk;

// default allowed slippage, in bips
export const INITIAL_ALLOWED_SLIPPAGE = 50
// 20 minutes, denominated in seconds
export const DEFAULT_DEADLINE_FROM_NOW = 60 * 20

export const MaxUint256: bigint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

export const DUMMY_VET = {
  1: new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000000', 18, 'VET', 'Vechain'),
  3: new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000000', 18, 'VET', 'Vechain')
}

export const VVET = {
  // [ChainId.MAINNET]: new Token(
  //   ChainId.MAINNET,
  //   '0xD8CCDD85abDbF68DFEc95f06c973e87B1b5A9997',
  //   18,
  //   'VVET',
  //   'Wrapped VET'
  // ),
  [ChainId.MAINNET]: new Token(
    ChainId.MAINNET,
    '0x45429A2255e7248e57fce99E7239aED3f84B7a53',
    18,
    'VVET',
    'Wrapped VET'
  ),
  // [ChainId.TESTNET]: new Token(
  //   ChainId.TESTNET,
  //   '0xD8CCDD85abDbF68DFEc95f06c973e87B1b5A9997',
  //   18,
  //   'WVET',
  //   'Wrapped VET'
  // ),
}