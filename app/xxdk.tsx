"use client";

import { createContext, useState, useEffect } from "react";
import Spinner from "@/components/Spinner";

import XXNDF from "./ndf.json";
import { CMix, XXDKUtils } from "xxdk-wasm/dist/src";
import xxdk = require("xxdk-wasm");

// XXContext is used to pass in "XXDKUtils", which
// provides access to all xx network functions to the children

export const XXContext = createContext<XXDKUtils | null>(null);
export const XXNet = createContext<CMix | null>(null);
export function XXNetwork({ children }: { children: React.ReactNode }) {
  const [XXDKUtils, setXXDKUtils] = useState<XXDKUtils | null>(null);
  const [XXCMix, setXXCMix] = useState<CMix | null>(null);

  useEffect(() => {
    // By default the library uses an s3 bucket endpoint to download at
    // https://elixxir-bins.s3-us-west-1.amazonaws.com/wasm/xxdk-wasm-[semver]
    // the wasm resources, but you can host them locally by
    // symlinking your public directory:
    //   cd public && ln -s ../node_modules/xxdk-wasm xxdk-wasm && cd ..
    // Then override with this function here:
    //xxdk.setXXDKBasePath(window!.location.href + "xxdk-wasm");
    xxdk.InitXXDK().then(async (xx: XXDKUtils) => {
      setXXDKUtils(xx);

      // Now set up cMix, while other examples download
      // you must hard code the ndf file for now in your application.
      const ndf = JSON.stringify(XXNDF);

      // The statePath is a localStorage path that holds cMix xx network state
      const statePath = "xx";

      // Instantiate a user with the state directory password "Hello"
      const secret = Buffer.from("Hello");
      const cMixParamsJSON = Buffer.from("");

      console.log(secret);

      const stateExists = localStorage.getItem("cMixInitialized");
      if (stateExists === null || !stateExists) {
        await xx.NewCmix(ndf, statePath, secret, "");
        localStorage.setItem("cMixInitialized", "true");
      }
      xx.LoadCmix(statePath, secret, cMixParamsJSON).then((net: CMix) => {
        // Once all of our clients are loaded we can start
        // listening to the network
        net.StartNetworkFollower(10000);
        net.WaitForNetwork(30000);
        setXXCMix(net);
      });
    });
  }, []);

  return (
    <XXContext.Provider value={XXDKUtils}>
      <XXNet.Provider value={XXCMix}>
        {!XXCMix ? (
          <div className="bg-black h-screen w-screen mt-0 fixed top-0 flex flex-col justify-center">
            <Spinner size="lg" />
            <p className="text-center mt-4">Connecting...</p>
          </div>
        ) : (
          children
        )}
      </XXNet.Provider>
    </XXContext.Provider>
  );
}