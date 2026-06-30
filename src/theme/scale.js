import { Dimensions } from 'react-native';
const BASE = 316;
const W = Dimensions.get('window').width;
const factor = W / BASE;
export const sc = (n) => Math.round(n * Math.min(Math.max(factor, 1), 1.35));
