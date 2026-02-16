import Head from "next/head";
import Component from "../components/component";

export default function Embed() {
  return (
    <>
      <Head>
        <title>Gracie Barra Map - Embed</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="robots" content="noindex" />
        <style>{`
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
        `}</style>
      </Head>
      <Component isEmbedMode={true} />
    </>
  );
}
