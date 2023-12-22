import {
  Logger,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { auto, forever } from 'async';
import {
  AuthenticatedLnd,
  SubscribeToForwardRequestsForwardRequestEvent as SubType,
  authenticatedLndGrpc,
  getWalletInfo,
  signMessage,
  subscribeToForwardRequests,
} from 'lightning';
import { AmbossService } from 'src/amboss/amboss.service';

const SHORT_CHANNEL_ID = '1052673x257x257';
const SUB_TIME_MS = 1000 * 5;
const EARLY_RETURN = 'UnableToConnect';

type StartSubAuto = {
  getEnvs: {
    socket: string;
    macaroon: string;
    cert: string | undefined;
  };
  getNode: AuthenticatedLnd;
  forwardRequests: void;
};

@Injectable()
export class NodeService implements OnModuleInit, OnModuleDestroy {
  isConnected = false;

  private subscriptions = [];
  private retryCount = 0;
  private readonly logger = new Logger(NodeService.name);

  constructor(
    private config: ConfigService,
    private ambossService: AmbossService,
  ) {}

  async onModuleInit() {
    this.startSubscription();
  }

  async onModuleDestroy() {
    this.subscriptions.forEach((sub) => sub.removeAllListeners());
  }

  private async startSubscription() {
    return forever(
      (next: any) => {
        return auto<StartSubAuto>(
          {
            getEnvs: async () => {
              const macaroon = this.config.get('LND_NODE_MACAROON');
              const socket = this.config.get('LND_NODE_SOCKET');
              const cert = this.config.get('LND_NODE_CERT');

              if (!macaroon) {
                this.logger.error('Macaroon missing in envs');
                throw new Error(EARLY_RETURN);
              }

              if (!socket) {
                this.logger.error('Socket missing in envs');
                throw new Error(EARLY_RETURN);
              }

              if (!cert) {
                this.logger.warn(
                  'No certificate provided. Make sure you dont need it to connect to your node.',
                );
              }

              return { socket, macaroon, cert };
            },

            getNode: [
              'getEnvs',
              async ({ getEnvs }) => {
                try {
                  const { lnd } = authenticatedLndGrpc(getEnvs);

                  const nodeInfo = await getWalletInfo({ lnd });

                  this.logger.log(
                    `Successfully connected to node ${nodeInfo.alias}`,
                  );

                  this.isConnected = true;

                  return lnd;
                } catch (error) {
                  this.logger.error('Error connecting to node', {
                    socket: getEnvs.socket,
                    error,
                  });

                  throw new Error(EARLY_RETURN);
                }
              },
            ],

            forwardRequests: [
              'getNode',
              ({ getNode }, cbk) => {
                const sub = subscribeToForwardRequests({ lnd: getNode });

                this.subscriptions.push(sub);

                sub.on('forward_request', async (data: SubType) => {
                  this.logger.debug('New forward request event', {
                    amount_msats: data.mtokens,
                    fee_msats: data.fee_mtokens,
                    in_channel: data.in_channel,
                    out_channel: data.out_channel,
                    payment_hash: data.hash,
                  });

                  if (data.out_channel !== SHORT_CHANNEL_ID) {
                    this.logger.debug('Accepting non ghost forward request');
                    data.accept();

                    return;
                  }

                  this.logger.log('Accepting ghost payment');

                  const { signature } = await signMessage({
                    lnd: getNode,
                    message: data.hash,
                  });

                  const info = await this.ambossService.getGhostPayment(
                    data.hash,
                    signature,
                  );

                  if (!info) {
                    this.logger.error('Unable to accept ghost payment', {
                      payment_hash: data.hash,
                    });
                    data.reject();

                    return;
                  }

                  if (data.mtokens < info.payment_amount) {
                    this.logger.error(
                      'Unable to accept ghost payment because size is below expected',
                      {
                        expected: info.payment_amount,
                        received: data.mtokens,
                      },
                    );
                    data.reject();

                    return;
                  }

                  if (!!info.preimage) {
                    data.settle({ secret: info.preimage });

                    this.logger.log('Accepted ghost payment request', {
                      info,
                    });

                    return;
                  }

                  this.logger.error('Error accepting ghost payment request', {
                    info,
                  });
                  data.reject();
                });

                sub.on('error', async (err) => {
                  sub.removeAllListeners();

                  this.logger.error(`Error in forward request subscription`, {
                    err,
                  });

                  cbk(new Error('Error in forward request subscription'));
                });
              },
            ],
          },
          async (err, results) => {
            this.subscriptions.forEach((sub) => sub.removeAllListeners());
            this.subscriptions = [];
            this.isConnected = false;

            if (err?.message === EARLY_RETURN) {
              next(EARLY_RETURN);
              return;
            }

            if (err) {
              this.logger.error('Async Auto Error', { error: err.message });
            } else {
              this.logger.error('Async Auto Results', { results });
            }

            this.retryCount = this.retryCount + 1;

            if (this.retryCount >= 6) {
              next('Max retries attempted');
              return;
            }

            const retryTime = SUB_TIME_MS * this.retryCount * this.retryCount;

            const message = `Restarting subscription (Retry: ${this.retryCount}) after ${retryTime} ms`;
            this.logger.warn(message);

            setTimeout(async () => {
              this.logger.warn('Restarting...');
              next(null, 'retry');
            }, retryTime);
          },
        );
      },
      async (error) => {
        this.logger.error('Subscriptions failed', { error });
        this.isConnected = false;
      },
    );
  }
}
