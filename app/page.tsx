"use client";
import { z } from "zod";
import { useCallback, useContext, useState } from "react";
import { XXContext, XXNet, XXNetwork } from "./xxdk";
import IdentityCommitmentForm from "./IdentityCommitmentForm";

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

export default function Home() {
  const utils = useContext(XXContext);
  const cmix = useContext(XXNet);
  const [identity, setIdentity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRpcEvent = (data: Uint8Array) => {
    const msg = decoder.decode(data);
    console.log("onRpcEvent called -> data: " + msg);
  };

  const onSubmit = useCallback(async () => {
    setError(null);
    const parsed = jsonStringSchema.safeParse(identity);

    if (parsed.error) {
      return setError("Wrong format for identity commitment");
    }

    try {
      console.log(
        cmix?.GetID()!,
        utils?.Base64ToUint8Array("uIllxXDkCOHgqONA7BjDPRPQ6nRG2X6nafenDHJUracD"),
        utils?.Base64ToUint8Array("fUkOFf4ys1TI42OcA4pn8cqlWagRIfMGcXmJIRR69/E="),
        encoder.encode(identity!),
        onRpcEvent
      );
      await utils?.RPCSend(
        cmix?.GetID()!,
        utils.Base64ToUint8Array("uIllxXDkCOHgqONA7BjDPRPQ6nRG2X6nafenDHJUracD"),
        utils.Base64ToUint8Array("fUkOFf4ys1TI42OcA4pn8cqlWagRIfMGcXmJIRR69/E="),
        encoder.encode(identity!),
        onRpcEvent
      );
    } catch (e) {
      console.error(e);
      setError("Something went wrong sending the cmix message");
    }
  }, [identity, utils, cmix]);

  return (
    <XXNetwork>
      <main className="min-h-screen p-10">
        <IdentityCommitmentForm />
      </main>
    </XXNetwork>
  );
}
