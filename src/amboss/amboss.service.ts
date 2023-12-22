import { Injectable, Logger } from '@nestjs/common';
import { DocumentNode, GraphQLError, print } from 'graphql';
import { gql } from 'graphql-tag';

export const getGhostPayment = gql`
  query GetGhostPayment($input: GhostPaymentInput!) {
    getGhostPayment(input: $input) {
      preimage
      payment_amount
    }
  }
`;

type Variables = {
  [key: string]: string | number | string[] | boolean | any[] | Variables;
};

@Injectable()
export class AmbossService {
  private readonly logger = new Logger(AmbossService.name);

  async graphqlFetch(
    url: string,
    query: DocumentNode,
    variables?: Variables,
  ): Promise<{
    data: any;
    error: undefined | GraphQLError;
  }> {
    const npmVersion = process.env.npm_package_version || '0.0.0';

    return fetch(url, {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'apollographql-client-name': 'ghost-client',
        'apollographql-client-version': npmVersion,
      },
      body: JSON.stringify({ query: print(query), variables }),
    })
      .then((res) => res.json() as any)
      .then((result) => {
        const { data, errors } = result;
        return {
          data,
          error: errors?.[0]?.message,
        };
      })
      .catch((error) => {
        this.logger.error('Error doing graphql fetch', { error });
        return { data: undefined, error };
      });
  }

  async getGhostPayment(paymentHash: string, signature: string) {
    const { data, error } = await this.graphqlFetch(
      'https://api.amboss.space/graphql',
      getGhostPayment,
      { input: { payment_hash: paymentHash, signature } },
    );

    if (!data?.getGhostPayment || error) {
      this.logger.error('Error getting ghost payment info', { data, error });
      return null;
    }

    return data.getGhostPayment;
  }
}
