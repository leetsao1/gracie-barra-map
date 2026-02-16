import React from "react";
import Head from "next/head";
import Component from "../components/component";

const Index = () => {
  return (
    <>
      <Head>
        <title>Gracie Barra - Find a School</title>
        <meta
          name="description"
          content="Find Gracie Barra Jiu-Jitsu schools worldwide. Search by location to discover the nearest Gracie Barra academy and start your journey."
        />
      </Head>
      <style>{`
        body {
          margin: 0;
        }
      `}</style>
      <Component />
    </>
  );
};

export default Index;
