#pragma once

// Adjust pin numbers to match your NORVI model

// Drafting gate solenoids
#define PIN_DRAFT_LEFT      18
#define PIN_DRAFT_RIGHT     19
#define PIN_DRAFT_STRAIGHT  21  // optional third lane

// Feed head relays / motor drivers
#define PIN_FEED_B1         25
#define PIN_FEED_B2         26

// EID reader interface (UART)
#define PIN_EID_TX          17
#define PIN_EID_RX          16

// Status LED
#define PIN_STATUS_LED      2

#define FEED_TICK_MS        100
