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
  const [identity, setIdentity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [roundUrl, setRoundUrl] = useState<string | null>(null);

  const onRpcEvent = (data: Uint8Array) => {
    const msg = decoder.decode(data);

    const parsed = rpcEventSchema.safeParse(JSON.parse(msg));

    if (parsed.error) {
      setError("Received an unexpected message");
    }

    if (parsed.data?.type === "SentMessage") {
      setState("Sent. Waiting for response...");
    }

    if (parsed.data?.type === "RoundResults") {
      setState("Processing");
      const [roundId] = Object.entries(parsed.data.response.results)?.[0];
      setRoundUrl(`https://dashboard.xx.network/rounds/${roundId}`);
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

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const parsed = jsonStringSchema.safeParse(identity);

      if (parsed.error) {
        return setError("Wrong format for identity commitment");
      }

      try {
        setState("Sending");
        await utils?.RPCSend(
          cmix?.GetID()!,
          utils.Base64ToUint8Array("uIllxXDkCOHgqONA7BjDPRPQ6nRG2X6nafenDHJUracD"),
          utils.Base64ToUint8Array("fUkOFf4ys1TI42OcA4pn8cqlWagRIfMGcXmJIRR69/E="),
          encoder.encode(identity!),
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
    <form>
      <div className="space-y-3">
        <label htmlFor="identity-commitment" className="text-lg font-bold">
          Identity Commitment
        </label>
        <textarea
          id="identity-commitment"
          className="w-full h-96 p-2 bg-zinc-950"
          placeholder={`{"identityCommitment": "0x301797..."}`}
          onChange={(e) => {
            setIdentity(e.target.value);
          }}
        ></textarea>
        <p className="text-red-500">{error}</p>
      </div>
      <div className="mt-4">
        <button
          disabled={state !== "Idle"}
          onClick={onSubmit}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Send
        </button>
      </div>
      {state !== "Idle" && (
        <div className="mt-4">
          <Spinner size="lg" />
          <p className="text-center">{state}</p>
        </div>
      )}
      {(result || roundUrl) && (
        <div className="mt-4">
          <h3 className="mt-10 text-3xl font-semibold">Results</h3>{" "}
          <a href={roundUrl ?? "#"} target="_blank" rel="noopener" className="text-blue-500 hover:underline">
            View Round
          </a>
          {result && (
            <>
              <pre className=" mt-4 bg-zinc-950 p-4 break-all w-full whitespace-pre-wrap">{result}</pre>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(result!);
                }}
                className="bg-gray-500 mt-4 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Copy Result
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
