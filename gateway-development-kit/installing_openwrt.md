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

### Updates from here on

The board checks [openwrt.mono.si](https://openwrt.mono.si) once a day.
When a new release is out, it writes a line to the system log and to
`/tmp/mono-update-available`. To install it:

```sh
sysupgrade <url from the file above>
```

Your settings survive the upgrade. If you would rather have the board
update itself with no questions asked:

```sh
uci set mono-update.check.mode='auto'
uci commit mono-update
```

Heads-up on `auto`: writing the new system takes a few seconds, and a
power cut in exactly that window leaves the board booting into
recovery. Fine on a desk, think twice for a device in a closet far
away.

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
