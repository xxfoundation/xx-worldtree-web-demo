"use client";
import { z } from "zod";
import { useCallback, useContext, useState } from "react";
import { XXContext, XXNet } from "./xxdk";

import Spinner from "@/components/Spinner";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const identityCommitmentSchema = z.object({
  identityCommitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const jsonStringSchema = z.string().refine((data) => {
  try {
    const parsed = JSON.parse(data);
    return !!identityCommitmentSchema.parse(parsed);
  } catch (e) {
    return false;
  }
});

const RoundSchema = z.object({
  ID: z.number(),
  UpdateID: z.number(),
  State: z.number(),
  BatchSize: z.number(),
  Topology: z.array(z.string()),
  Timestamps: z.array(z.union([z.number(), z.bigint()])),
  ResourceQueueTimeoutMillis: z.number(),
  AddressSpaceSize: z.number(),
  EccSignature: z.object({
    Nonce: z.string(),
    Signature: z.string(),
  }),
});

const ResultsSchema = z.record(
  z.object({
    Status: z.number(),
    Round: RoundSchema,
  })
);

const RoundResultsSchema = z.object({
  success: z.boolean(),
  timedOut: z.boolean(),
  results: ResultsSchema,
});

const rpcEventSchema = z.union([
  z.object({
    type: z.literal("SentMessage"),
  }),
  z.object({
    type: z.literal("RoundResults"),
    response: RoundResultsSchema,
  }),
  z.object({
    type: z.literal("QueryResponse"),
    response: z.object({
      message: z.string(),
    }),
  }),
]);

export default function IdentityCommitmentForm() {
  const [state, setState] = useState<"Idle" | "Sending" | "Sent. Waiting for response..." | "Processing">("Idle");
  const utils = useContext(XXContext);
  const cmix = useContext(XXNet);
  const [identity, setIdentity] = useState<string>("0x3017972D13A39795AD0D1C3A670D3D36A399B4435E61A510C2D57713D4F5C3DE");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [roundUrl, setRoundUrl] = useState<string | null>(null);
  const [showDesc, setDescVisibility] = useState<boolean>(true);

  const onRpcEvent = (data: Uint8Array) => {
    const msg = decoder.decode(data);

    const parsed = rpcEventSchema.safeParse(JSON.parse(msg));

    if (parsed.error) {
      setError(`Received an unexpected message: ${msg}`);
    }

    if (parsed.data?.type === "SentMessage") {
      setState("Sent. Waiting for response...");
    }

    if (parsed.data?.type === "RoundResults") {
      setState("Processing");
      const entries = Object.entries(parsed.data.response.results);
      if (entries != null && entries.length != 0) {
        const [roundId] = entries[0];
        setRoundUrl(`https://dashboard.xx.network/rounds/${roundId}`);
      }
    }

    if (parsed.data?.type === "QueryResponse") {
      setState("Idle");
      setResult(
        JSON.stringify(
          {
            ...parsed.data,
            response: {
              ...parsed.data.response,
              message: JSON.parse(atob(parsed.data.response.message)),
            },
          },
          null,
          2
        )
      );
    }
  };

  const toggleDesc = useCallback(
    async() => {
      if (showDesc) {
        setDescVisibility(false);
      } else {
        setDescVisibility(true);
      }
    }, [showDesc]
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const identityReq = `{"identityCommitment": "${identity}"}`;
      const parsed = jsonStringSchema.safeParse(identityReq);

      if (utils === null) {
        return setError("xxdk not ready yet");
      }

      if (parsed.error) {
        return setError("Wrong format for identity commitment");
      }

      try {
        const rpcReceipient = utils.Base64ToUint8Array("+FC2TNKXsFt0iNcAQw3aPITP7QhcLjMdEQvjgPti7ckD");
        const rpcPubKey = utils.Base64ToUint8Array("bHBZilQlWTmAadhRJVTcg/XCBjjpU9hD/KglmjSXUEo=");

        setState("Sending");
        setDescVisibility(false);
        await utils?.RPCSend(
          cmix!.GetID()!,
          rpcReceipient,
          rpcPubKey,
          encoder.encode(`inclusionProof,${identityReq}`),
          onRpcEvent
        );
      } catch (e) {
        setState("Idle");
        console.error(e);
        setError("Something went wrong sending the cmix message");
      }
    },
    [identity, utils, cmix]
  );

  return (
    <div>
    <div className="flex w-full">
    <img src="worldcoin-foundation-logo.svg" className="flex-none w-10 bg-white rounded-full items-center justify-center p-1 mr-5" />
    <h1 className="flex-grow text-3xl font-bold text-center">World-Tree Anonymous Identity Commitment Lookup</h1>
    <img src="xx network-logo.svg" className="flex-none w-10 bg-white rounded-full items-center justify-center p-1 ml-5" />
    </div>
    <div className="text-xs px-5 pt-3"><a href="#"
          className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500"
          onClick={toggleDesc}
          >
    {showDesc ? "hide":"show"} description</a></div>
    {showDesc && (<div><p className="py-5 px-5">
    This app allows you to query a <a href="https://github.com/worldcoin/world-tree" 
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
        world-tree server
    </a> anonymously through the <a href="https://xx.network/"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    xx network
    </a>. The world-tree service plays a critical role in the <a 
      href="https://whitepaper.worldcoin.org/#worldcoin-protocol"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    Worldcoin Protocol
    </a> by enabling privacy preserving inclusion proofs for any given worldcoin identity. 
    Inclusion proofs provide a privacy preserving mechanism for <a 
      href="https://whitepaper.worldcoin.org/#proof-of-personhood-(pop)"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    proof of personhood
    </a>. Querying through XX network provides robust privacy metadata protections to users
    by using an anonymous messaging layer that eliminates identification via client-side
    associations. More generally, this project demonstrates protected communication between 
    Worldcoin User Agents and services with network level anonymization, reducing the risk 
    of metadata leakage.
    </p>
    <p className="px-5 pb-5">
    You can use <a href="https://git.xx.network/xx_network/xx-worldtree-web-demo"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    this example
    </a> as a template for trivially making world-tree queries in your app. See the <a 
      href="https://git.xx.network/xx_network/xxdk-examples"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">

    xxdk-examples
    </a> repository for how to use xxdk in Rust, Android, iOS, Web, and Golang. Check out 
    our <a href="https://github.com/xxfoundation/world-tree/pull/2"
          className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    pull request
    </a> for how to make rust-based services accessible via the xx network. 
    </p>
    <p className="px-5">
    This work was funded by the <a 
      href="https://worldcoin.org/"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    Worldcoin Foundation
    </a> as a Human Collective Grant Recipient in <a 
      href="https://worldcoin.org/wave0-grant-recipients/xx-network"
      className="text-blue-500 underline hover:text-blue-700 visited:text-purple-500">
    wave0 
    </a> of their grant program. 
    </p></div>
    )}
    <form>
      <div className="space-y-3 pt-5">
        <label htmlFor="identity-commitment" className="font-bold">
          Enter an Identity Commitment: 
        </label>
      </div>
      <div className="flex w-full">
        <input
          type="text"
          id="identity-commitment"
          name="identity-commitment"
          className="flex-grow p-2 border-1 dark:text-black"
          defaultValue={identity}
          onChange={(e) => {
            setIdentity(e.target.value);
          }}
        ></input>
        <button
          disabled={state !== "Idle"}
          onClick={onSubmit}
          className="flex-none w-32 mx-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Send
        </button>
      </div>
      <p className="text-red-500">{error}</p>
      {state !== "Idle" && (
        <div className="mt-4">
          <p className="text-center">{state}</p>
          <div className="flex justify-center mt-4 items-center">
          <div className="flex-none w-20 mr-5"><Spinner size="md" /></div>
          {(state == "Sent. Waiting for response..." || state == "Processing") && (
            <div className="flex mx-2 w-50 items-center align-middle justify-items-center">
              <div
              className="h-0 w-0 border-y-8 border-y-transparent border-l-[24px] border-l-blue-600"
            ></div>
            <img src="worldcoin-foundation-logo.svg" className="flex-none w-28 bg-white rounded-full items-center justify-center p-1 mx-5" />
            </div>
          )}
          {(state == "Processing") && (
            <div className="flex w-50 items-center align-middle justify-items-center">
              <div
                className="h-0 w-0 border-y-8 border-y-transparent border-l-[24px] border-l-blue-600 mr-5"
              ></div>
              <Spinner size="md" />
            </div>
          )}
        </div>
        </div>
      )}
      {(result || roundUrl) && (
        <div className="mt-4">
          <h3 className="mt-10 text-3xl font-semibold">Results</h3>{" "}
          <a href={roundUrl ?? "#"} target="_blank" rel="noopener">
          <button className="bg-blue-500 mt-4 hover:bg-blue-700 text-white font-bold py-1 px-2 m-1 rounded"
            onClick={(e) =>
              {
                e.preventDefault();
                if (roundUrl) {
                  window.open(roundUrl, "_blank");
                }
              }
            }
          >
            View Round
            </button>
            </a>
          {result && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(result!);
                }}
                className="bg-blue-500 mt-4 hover:bg-blue-700 text-white font-bold py-1 px-2 m-1 rounded"
              >
                Copy Result
              </button>
              <pre className=" mt-4 p-4 break-all w-full h-1/4 border-1 overflow-auto">{result}</pre>
            </>
          )}
        </div>
      )}
    </form>
    </div>
  );
}
