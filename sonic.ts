import "isomorphic-fetch";
import { Actor, HttpAgent } from "@dfinity/agent";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import {
  ActorAdapter,
  SwapCanisterController,
  createSwapActor,
} from "@psychedelic/sonic-js";

import { identity, principal } from "./src/identity/identity";
import { SONIC_ENV } from "./sonic_env";

const { WICP, XTC } = SONIC_ENV.canistersPrincipalIDs;

const { host } = SONIC_ENV;

export const myAgent = new HttpAgent({
  identity,
  host,
});

export const provider: ActorAdapter.Provider = {
  agent: myAgent,
  createActor: <T>({
    agent,
    canisterId,
    interfaceFactory,
  }: {
    interfaceFactory: InterfaceFactory;
    agent: HttpAgent;
    canisterId: string;
  }) => {
    const actor = Actor.createActor<T>(interfaceFactory, {
      agent: myAgent,
      canisterId,
    });
    return actor;
  },
  createAgent: async (params: ActorAdapter.CreateAgentParams) => {
    const agent = new HttpAgent({
      ...params,
      identity,
      host: params.host || host,
    });
    return agent;
  },
};

const main = async () => {
  console.log("My Nodejs Principal", principal.toText());
  const adapter = new ActorAdapter(provider);

  const mySwapActor = await createSwapActor({ actorAdapter: adapter });

  const swapController = new SwapCanisterController(mySwapActor);

  let list = await swapController.getPairList();

  console.log("list", list);

  let p = await swapController.getAgentPrincipal();
  console.log("my swapController Principal", p.toString());

  let balances = await swapController.getTokenBalances(p.toString());

  let tokenInAllowanceAmount = "0.001";
  let slippage = 0.01;
  let tokenIn = WICP;
  let tokenOut = XTC;

  console.log(
    `tokenIn: ${tokenIn} balance`,
    Number(balances[tokenIn].total).toFixed(5),
  );
  console.log(
    `tokenOut: ${tokenOut} balance`,
    Number(balances[tokenOut].total).toFixed(5),
  );

  if (Number(balances[tokenIn].total) < Number(tokenInAllowanceAmount)) {
    throw Error(
      `You don't have sufficient funds of ${tokenIn} please make sure to transfer some first`,
    );
  }

  let approve = await swapController.approve({
    tokenId: tokenIn,
    amount: tokenInAllowanceAmount,
  });

  console.log("approve", approve);

  let deposit = await swapController.deposit({
    tokenId: tokenIn,
    amount: tokenInAllowanceAmount,
  });

  console.log("deposit", deposit);

  let swap = await swapController.swap({
    amountIn: tokenInAllowanceAmount,
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    slippage: slippage,
  });

  // check after swap
  await swapController.getTokenBalances(p.toString());
  console.log("balances", balances);
  console.log("wicp balance", Number(balances[tokenIn].total).toFixed(5));
  console.log("xtc balance", Number(balances[tokenOut].total).toFixed(5));

  console.log("swap", swap);

  let withdraw = await swapController.withdraw({
    amount: "0.01", // need to figure out how to get this amout automatically
    tokenId: tokenOut,
  });

  console.log("withdraw", withdraw);
};

main();
