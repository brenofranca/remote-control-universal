export type TvProtocol = 'androidtv';

export interface TvDevice {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly port: number;
  readonly protocol: TvProtocol;
}
