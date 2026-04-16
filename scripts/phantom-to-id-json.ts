#!/usr/bin/env ts-node
/// <reference types="node" />
import bs58 from "bs58";
import * as fs from "fs";

const pk = "L1P1FooJ7WCk8rxmWSA1DC23GswbftTQ8EPQDLFRYRjfhYEuM51actBkV9zMX4KsUXiKFWjvzGUAAXobXxBiu9F";
if (!pk) {
  console.error("PHANTOM_PK='<base58>' yarn phantom:id   OR   yarn phantom:id '<base58>'");
  process.exit(1);
}
fs.writeFileSync("id.json", JSON.stringify([...bs58.decode(pk)]));
console.log("id.json");
