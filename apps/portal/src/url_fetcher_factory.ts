// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { UrlFetcher } from '@lib/url_fetcher';
import { ResourceFetcher } from '@lib/resource';
import { RPCSelector } from '@lib/rpc_selector';
import { SuiNSResolver } from '@lib/suins';
import { WalrusSitesRouter } from '@lib/routing';
import { PriorityExecutor, type PriorityUrl } from '@lib/priority_executor';
import { config } from './config';

// Zod's inferred output for the priorityUrlEntrySchema marks `url` as
// `string | undefined` despite the `.url()` validator (Zod 3 quirk). Cast to
// the loader's canonical `PriorityUrl` shape — the runtime value is always
// well-formed because the Zod parse rejects entries without a string url.
const rpcUrlList = config.rpcUrlList as PriorityUrl[];
const premiumRpcUrlList = config.premiumRpcUrlList as PriorityUrl[] | undefined;
const aggregatorUrlList = config.aggregatorUrlList as PriorityUrl[];

/**
 * A factory class for creating page fetchers.
 * Page fetchers can be either premium or standard.
 * Premium fetchers use premium RPC nodes that can serve content faster and more reliably,
 * while standard fetchers use standard RPC nodes.
 */
class UrlFetcherFactory {
  private static readonly premiumRpcSelector = premiumRpcUrlList
    ? new RPCSelector(premiumRpcUrlList, config.suinsClientNetwork)
    : undefined;
  private static readonly standardRpcSelector = new RPCSelector(
    rpcUrlList,
    config.suinsClientNetwork,
  );

  private static readonly aggregatorExecutor = new PriorityExecutor(aggregatorUrlList);

  public static premiumUrlFetcher(): UrlFetcher | undefined {
    if (!this.premiumRpcSelector) return undefined;
    return new UrlFetcher(
      new ResourceFetcher(this.premiumRpcSelector, config.originalPackageId),
      new SuiNSResolver(this.premiumRpcSelector),
      new WalrusSitesRouter(this.premiumRpcSelector),
      this.aggregatorExecutor,
      config.b36DomainResolutionSupport,
    );
  }

  public static standardUrlFetcher(): UrlFetcher {
    return new UrlFetcher(
      new ResourceFetcher(this.standardRpcSelector, config.originalPackageId),
      new SuiNSResolver(this.standardRpcSelector),
      new WalrusSitesRouter(this.standardRpcSelector),
      this.aggregatorExecutor,
      config.b36DomainResolutionSupport,
    );
  }
}

export const standardUrlFetcher = UrlFetcherFactory.standardUrlFetcher();
export const premiumUrlFetcher = UrlFetcherFactory.premiumUrlFetcher();
