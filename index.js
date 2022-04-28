import dgram from "dgram"; // UDP Protocal only
// I don't particularly care about TCP, the RFCs *technically* want TCP support but for a simple thing just to challenge
// myself I really don't think it's necessary to figure out how to make it work.

const host = "localhost";
const port = "53";

// CR: https://github.com/sh1mmer/dnsserver.js/blob/master/dnsserver.js, lines 31-36

var sliceBits = function (b, off, len) {
  // I don't fully understand how this works but I have some level of idea, all I
  // really know about it is that it works.
  // B is the byte (assumes 1 byte), off is the offset (i.e. starting on X byte because Y bytes are already used), len is
  // the length of the byte.
  var s = 7 - (off + len - 1);
  b = b >>> s;
  return b & ~(0xff << len);
};

const server = dgram.createSocket("udp4");

server.on("message", (req) => {
  const ID = req.slice(0, 2);
  const misc = req.slice(2, 3); // QR, Opcode, AA/TC/RD/RA, Z, RCode
  const QDCount = req.slice(3, 4);
  const ANCount = req.slice(4, 5);
  const NSCount = req.slice(5, 6);
  const ARCount = req.slice(6, 7);
  const QR = sliceBits(misc, 0, 1);
  const opcode = sliceBits(misc, 1, 4);
  const AA = sliceBits(misc, 5, 1);
  const TC = sliceBits(misc, 6, 1);
  const RD = sliceBits(misc, 7, 1);
  const RA = sliceBits(misc, 8, 1);
  const Z = sliceBits(misc, 9, 3); // No real reason to add this, but I'm just going to make the server reject anything
  // with this as 1
  const RCode = sliceBits(12, 4);
  const header = {
    ID,
    misc,
    QDCount,
    ANCount,
    NSCount,
    ARCount,
    misc: {
      QR,
      opcode,
      AA,
      TC,
      RD,
      RA,
      Z,
      RCode,
    },
  };
  handle(header, req);
});

function handle(header, req) {
  if (
    header.misc.QR ||
    header.misc.Z ||
    header.ANCount ||
    header.NSCount ||
    header.ARCount
  ) {
    // Invalid, these should only be nonzero if it's a reply; this server should not be querying.
    return;
  }
  let questions = [];
  for (let i = 0; i < Math.min(header.QDCount, 20); i++) {
    questions.push({
      QName: req.slice(7 + i * 5, 10 + i * 5),
      QType: req.slice(10 + i * 5, 11 + i * 5),
      QClass: req.slice(11 + i * 5, 12 + i * 5),
    });
  } // There are 20 different QType values, and as such I will only allow a maximum of 20 for QDCount. Past that, it would
  // just make me loop for way too long.
}

server.bind(port);
