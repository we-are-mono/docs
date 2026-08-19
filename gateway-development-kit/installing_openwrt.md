# OpenWRT on the Mono Gateway

Our OpenWRT build comes with hardware offloading (ASK), all board
hardware working out of the box, and automatic updates.

* Source: [github.com/we-are-mono/openwrt](https://github.com/we-are-mono/openwrt) (branch `mono`)
* Images: [openwrt.mono.si](https://openwrt.mono.si) and the GitHub
  [releases page](https://github.com/we-are-mono/openwrt/releases)
* Releases are named `mono-v25.12.5`, `mono-v25.12.5-r2`, and so on.
  The first part is the OpenWRT version we build on; the `-rN` suffix
  means we changed something on our side (usually an ASK update)
  without waiting for a new OpenWRT release.

## Part 1: Getting started

You flash the board once, from recovery Linux. After that it updates
itself over the network and you never need this procedure again
(unless you brick it, in which case: this procedure un-bricks it too).

### 1. Boot into recovery

Set the boot DIP switch to **NOR** and power-cycle. The board stops
in U-Boot; start recovery Linux by typing:

```
run recovery
```

Log in as `root` — no password.

### 2. Get networking up

Recovery has no network configured. Plug a cable into one of the
ports — see the
[hardware description](hardware-description.md) for which physical
port is which `ethN` — then:

```sh
ip link set eth0 up
udhcpc -i eth0
```

(Replace `eth0` with the port you plugged into. If your network has
no DHCP, set a static address with `ip addr add` and
`ip route add default via ...` instead.)

### 3. Download and write the image

```sh
cd /tmp
wget https://openwrt.mono.si/mono-v25.12.5-r3/openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img.gz
gunzip openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img.gz

DEV=/dev/mmcblk0
IMG=openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img
dd if=$IMG of=$DEV bs=512 count=8
dd if=$IMG of=$DEV bs=1M skip=32 seek=32
sync
```

(Replace the release in the URL with the newest one from
[openwrt.mono.si](https://openwrt.mono.si).)

Why two `dd` commands instead of one? The area from 4 KB to 32 MB on
the eMMC belongs to the boot firmware (the low-level pieces that run
before Linux) and its own update tool. The image deliberately leaves
it alone: the first command writes the partition table into the first
4 KB, the second writes the actual system from 32 MB onward. Nothing
in between is ever touched. See Part 2 for the details.

### 4. Tell U-Boot how to boot it

Set the DIP switch back to **eMMC**, power-cycle, and press any key
during the countdown to stop in U-Boot. Then:

```
setenv openwrt 'setenv bootargs "${bootargs_console} boot_medium=emmc root=/dev/mmcblk0p2 rootwait"; run emmc_load && booti ${kernel_addr_r} - ${fdt_addr_r}'
setenv bootcmd 'run openwrt || run recovery'
saveenv
boot
```

This makes the board boot OpenWRT normally, and fall back to recovery
Linux automatically if that ever fails.

### 5. First boot

The first boot takes a few seconds longer: the filesystem grows itself
to fill the whole eMMC (about 29 GB). After that:

* LuCI (the web interface) is on `https://192.168.1.1`
* Ports: **eth0–eth2** are the LAN bridge, **eth3** is WAN (DHCP),
  **eth4** is a second LAN (`192.168.2.1`)
* Login is root with no password — set one.

### Updating

The board checks [openwrt.mono.si](https://openwrt.mono.si) once a day and
notes any new release in the system log (and in
`/tmp/mono-update-available`). How you install that release depends on which
version the board is currently running.

Either way your settings survive, and the image is verified before anything
is written — its signature and hash are checked against the signed release
manifest. And either way, one **heads-up**: writing the new system takes a
few seconds, and a power cut in exactly that window leaves the board booting
into recovery. Fine on a desk; think twice for a device in a closet far away.

#### mono-v25.12.5-r7 and earlier

The updater (`mono-update-check`) is driven by a single mode setting and only
notifies by default. To install, switch it to verified auto-install and
either wait for the daily check or run it now:

```sh
uci set mono-update.check.mode='auto'
uci commit mono-update
mono-update-check          # apply now instead of waiting for the daily check
```

Left at `auto`, every future release installs itself unattended; set it back
to `notify` afterwards if you only wanted the one update. Do not `sysupgrade`
the release URL by hand — that path skips the signature and hash checks.

#### mono-v25.12.5-r8 and up

r8 replaces the mode dance with an on-demand command and a LuCI page, so a
one-off update no longer means flipping a persistent setting.

From LuCI: open **System → Updates**, click **Check for updates**, then
**Install update** if one is offered.

From the shell:

```sh
mono-update --check      # is a newer signed release available?
mono-update --install    # verify + flash the newest signed release (reboots)
```

Running `mono-update` with no arguments prints this usage. The daily
background check still only notifies; for unattended updates set
`mono-update.check.mode='auto'` as before, and at the default `notify`
nothing is flashed without you asking.

The command and page exist only once the board is running r8 or newer;
update *to* r8 from an older release using the procedure above.

#### Updating to mono-v25.12.5-r9 (the A/B migration)

r9 introduces **A/B boot slots** — two rootfs copies, so a failed update rolls
itself back to the previous working one instead of dropping you into recovery.
Reaching that layout means re-carving the eMMC once, so **the update to r9
reboots twice** — both automatically, nothing for you to do:

1. `mono-update --install` verifies and writes the new system, then reboots
   into it (as every update does).
2. On that first boot the board shrinks the single rootfs partition, adds the
   second slot and a persistent `/data` partition, and **reboots itself once
   more** to bring the new layout into effect.

So the board comes up, restarts on its own, and then settles — a brief double
boot that is normal and happens on this one update only. Every update after r9
is a single reboot, and a bad one rolls back on its own.

Why the second reboot can't be skipped: the eMMC is full, so the rootfs must
shrink to make room, and the running kernel will not accept a new partition
table while it is booted from that partition — only a reboot re-reads it. Boards
freshly flashed from recovery already carry the A/B layout and skip all of this.

## Part 2: How the image works

This part explains what is inside the image and why. You do not need
any of it to use the board.

### Why we build our own image at all

The LS1046A chip in the Gateway has a network engine (called FMan)
that can forward packets entirely in hardware — the CPU never sees
them. The software that drives this is **ASK**, our maintained version
of NXP's offloading stack.

The catch: ASK needs NXP's version of the Linux kernel, because the
FMan drivers only exist there. Stock OpenWRT builds the standard
kernel from kernel.org. So our build tells OpenWRT to fetch NXP's
kernel (pinned to an exact version) and applies the ASK patches on
top during the build. Everything is fetched from public sources at
fixed versions — the same inputs always give the same image, on any
machine.

### How offloading actually works

In plain terms:

1. The first packets of every connection go through Linux normally —
   firewall, NAT, routing, all of it.
2. A small daemon called **cmm** watches the connection table. Once a
   connection is established and it knows everything about it (where
   it goes, what NAT does to it), it programs that connection into
   the FMan's hardware table.
3. From then on, packets of that connection are forwarded, rewritten
   and NAT-ed by the chip itself. The CPU is not involved at all.
4. When the connection dies (or a port goes down, or routing
   changes), cmm removes it from the hardware again.

The firewall still fully applies — rules are enforced on those first
packets, and only connections the firewall allowed ever reach the
hardware table.

### The pieces

| Piece | What it is | What it does |
|---|---|---|
| `cdx.ko` | kernel module | Programs the FMan hardware table. Loads at boot and starts `dpa_app`. |
| `dpa_app` | program, runs once at boot | Loads the packet-classification setup into the FMan (from `/etc/cdx_cfg.xml` and friends). |
| `fci.ko` | kernel module | The messenger: passes commands from cmm down to cdx. |
| `auto_bridge.ko` | kernel module | Notices bridged (switch-style) traffic so it can be offloaded too, not just routed traffic. |
| `cmm` | daemon | The brain. Watches connections, decides what gets offloaded. |
| `fmc` / `fmlib` | NXP tool + library | Used by dpa_app to talk to the FMan driver. |
| patched `libnetfilter-conntrack` | library | Lets cmm see the extra connection details our kernel attaches. |

All ASK pieces are built from one pinned commit of the
[ASK repository](https://github.com/we-are-mono/ASK) — the kernel
patches and the programs can never get out of step with each other.

A few connection types are deliberately never offloaded (FTP, SIP,
PPTP — they need the CPU to inspect them). The list lives in
`/etc/config/fastforward`.

### Board support

Beyond offloading, the image carries the Gateway's board bits:

* **Device tree** from our `meta-mono` layer — the same board
  description Armbian and the Yocto test image use.
* **LED drivers**: the LP5812 status LED and the SFP link/activity
  LEDs.
* **Fan control**: the standard lm-sensors `fancontrol` with the same
  curve as our other images — fan off below 40 °C, ramping linearly
  to full at 80 °C, driven by the SoC temperature.
* **Sensors**: the eight INA234 power monitors, temperature sensors
  and the fan controller all show up under `/sys/class/hwmon`.
* One image serves the whole product family. The only per-device
  offloading file (`cdx_cfg.xml`) ships in all variants and the right
  one is picked at boot by board name — Gateway DK today, Gateway and
  Gateway Pro when they arrive.

### The eMMC layout

```
0-4 KB   the partition table (GPT), complete
4 KB     ┐
         │ boot firmware: PBL, FIP (U-Boot), U-Boot env, FMan microcode
32 MB    ┘ (owned by the firmware update tool - not ours)
32 MB    partition 1: boot (kernel + device tree)
96 MB    partition 2: rootfs (ext4, grows to fill the disk on first boot)
```

Two unusual choices, both because of the firmware region:

* A normal partition table spills past 4 KB (its list of partitions
  alone reserves 16 KB). Everything from 4 KB to 32 MB belongs to the
  firmware and its update tool, so our table is slimmed down - it
  lists up to 8 partitions instead of the usual 128 - and the whole
  thing fits in the first 4 KB. Linux and U-Boot are fine with that;
  some desktop partitioning tools may grumble.
* The rootfs partition is created at its final size **in the image**,
  and only the filesystem grows on first boot. The partition table on
  the device is never rewritten - repartitioning tools would write a
  full-size table right over the firmware.

Updates (`sysupgrade`) rewrite only the two partitions. The firmware
region and the partition table are never touched by anything after
the first flash.

### How releases happen

We build nightly. Each night the build machine checks for work and
releases in two cases:

* **OpenWRT ships a new stable version** (say v25.12.6): the script
  moves our changes on top of it, rebuilds, and publishes
  `mono-v25.12.6`.
* **We committed something** (say an ASK update): the script rebuilds
  the same OpenWRT base with the new changes and publishes a revision,
  e.g. `mono-v25.12.5-r4`.

Publishing means: images to [openwrt.mono.si](https://openwrt.mono.si),
source and a GitHub release to
[we-are-mono/openwrt](https://github.com/we-are-mono/openwrt).
Deployed boards notice within a day.

To build the same image yourself:

```sh
git clone -b mono https://github.com/we-are-mono/openwrt
cd openwrt
./scripts/feeds update -a && ./scripts/feeds install -a
cp configs/mono_gateway-dk.seed .config
make defconfig && make
```

## Wi-Fi

The image ships a driver and firmware for the **u-blox JODY-W377-00B** module
(NXP 88W9098, Wi-Fi 6). It is optional — the same image runs unchanged whether or
not a module is fitted; Wi-Fi simply stays dormant when the slot is empty.

### Fitting the module

The Gateway Development Kit has **two M.2 slots, `M2_1` and `M2_2`**. Install the
JODY-W377-00B in **`M2_2`**.

The module also needs **three U.FL antennae**, purchased separately — fit one to
each U.FL connector on the card.

### Configuring

The 88W9098 is a dual-MAC (2×2 + 2×2) radio, so it appears as **two radios** in
LuCI under *Network → Wireless* (managed natively — no extra setup needed). Both
are auto-detected on the 5 GHz band; to put one on 2.4 GHz, change its band in
LuCI, or from the shell:

```
uci set wireless.radio0.band='2g'
uci set wireless.radio0.htmode='HE40'
uci commit wireless
wifi reload
```

Set SSIDs and encryption per device in LuCI as usual.

Both bands run Wi-Fi 6 at 40 MHz-wide channels (HE40). 80 MHz (HE80) on 5 GHz is
currently rejected by the module driver even where the regulatory domain permits
it, so leave 5 GHz at HE40.

{% hint style="warning" %}
**A client that connects but has no internet is almost always DNS, not Wi-Fi.**
The giveaway on an iPhone or iPad: under _Wi-Fi → ⓘ → Configure DNS: Automatic_ the
DNS-server list is **empty**, and the Wi-Fi icon drops to cellular. It associated,
got an IP, and simply has no resolver.

This bites whenever something takes port 53 and moves dnsmasq aside — the image's
**AdGuard Home** puts dnsmasq on `5353` — because dnsmasq then stops advertising
_itself_ as the DHCP DNS server and nothing else fills in. Linux and Android fall
back to the gateway and never notice; iOS doesn't, so it is left with no DNS at
all. Setting a manual DNS on the device (e.g. `192.168.1.1`) works and confirms it.

Fix it on the router by handing out a DNS server explicitly, once per DHCP-served
network, each pointing at that network's own gateway (AdGuard listens on all of
them):

```sh
uci add_list dhcp.lan.dhcp_option='6,192.168.1.1'   # repeat per network → its gateway
uci commit dhcp
/etc/init.d/dnsmasq reload
```
{% endhint %}

### One SSID on both bands, with band steering

To present a single network name across 2.4 and 5 GHz — where dual-band clients
are actively pushed onto 5 GHz and nudged to roam as they move around — combine
three things: one radio per band sharing the **same SSID**, **802.11k/v** on both,
and the **usteer** steering daemon. All of it ships in the image.

**1. One radio per band, identical SSID.** Put `radio0` on 2.4 GHz and `radio1` on
5 GHz, and give both interfaces the same SSID, encryption and key:

```sh
# radios: one per band (set country to your regulatory domain)
uci set wireless.radio0.band='2g'; uci set wireless.radio0.htmode='HE40'
uci set wireless.radio1.band='5g'; uci set wireless.radio1.htmode='HE40'
uci set wireless.radio0.country='SI'; uci set wireless.radio1.country='SI'

# both interfaces: same SSID/key + 802.11k (neighbour/beacon reports)
# and 802.11v (BSS transition management)
for i in default_radio0 default_radio1; do
    uci set wireless.$i.ssid='YourNetwork'
    uci set wireless.$i.encryption='sae-mixed'      # WPA2/WPA3
    uci set wireless.$i.key='your-passphrase'
    uci set wireless.$i.ieee80211k='1'
    uci set wireless.$i.rrm_neighbor_report='1'
    uci set wireless.$i.rrm_beacon_report='1'
    uci set wireless.$i.ieee80211v='1'
    uci set wireless.$i.bss_transition='1'
done
uci commit wireless
wifi reload
```

Clients now see one network and can roam between the bands: 802.11k tells a client
which other AP/band exists, 802.11v lets the AP ask it to move.

**2. Enable band steering (usteer).** 802.11k/v only *advertises* the other band;
`usteer` is what actively steers. It ships installed but disabled — configure and
enable it:

```sh
u=usteer.@usteer[0]
uci set $u.assoc_steering='1'          # refuse 2.4 GHz assoc for 5 GHz-capable clients
uci set $u.band_steering_min_snr='-75' # only steer up if 5 GHz would hold this signal
uci set $u.signal_diff_threshold='15'  # roam if another band is >15 dB better
uci set $u.roam_trigger_snr='20'       # nudge an 802.11v roam below this SNR
uci set $u.roam_scan_snr='25'
uci set $u.load_kick_enabled='0'       # no load-based kicking
uci commit usteer
/etc/init.d/usteer enable && /etc/init.d/usteer start
```

`assoc_steering` is the core "prefer 5 GHz": a dual-band client that tries to join
on 2.4 GHz is refused until it comes up on 5 GHz instead. The `roam_*` and
`signal_diff_threshold` settings handle already-connected clients that wander off —
usteer sends them an 802.11v BSS-transition request toward the stronger AP/band.
A status page lives under *Network → Wireless → usteer*.

Option names drift between usteer versions; the shipped `/etc/config/usteer` is
fully commented, so check it there if the daemon rejects one.
