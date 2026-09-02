---
title: "OpenWrt on the Mono Gateway"
navLabel: "Installing OpenWrt"
section: "Gateway development kit"
order: 5
---

Our OpenWrt build comes with hardware offloading (ASK), all board
hardware working out of the box, and self-service updates over the network.

* Source: [github.com/we-are-mono/openwrt](https://github.com/we-are-mono/openwrt) (branch `mono`)
* Images: [openwrt.mono.si](https://openwrt.mono.si) and the GitHub
  [releases page](https://github.com/we-are-mono/openwrt/releases)
* Each release is a folder on [openwrt.mono.si](https://openwrt.mono.si), named like
  **`mono-v25.12.5-r1787707074`** — `25.12.5` is the OpenWrt version, and the long number
  after `-r` is the specific build (bigger = newer). That number is different every release,
  so always use the **newest** folder — Step 3 below shows exactly how to find it.

## Part 1: Installing

You flash the board once, from recovery Linux. After that it updates itself
over the network and you never need this procedure again (unless you brick it —
in which case this procedure un-bricks it too).

### 1. Boot into recovery

Set the boot DIP switch to **NOR** and power-cycle. The board stops in U-Boot;
start recovery Linux by typing:

```bash
run recovery
```

Log in as `root` — no password.

:::info
If `run recovery` fails with `Bad Linux ARM64 Image magic!` (or similar), the
board's low-level firmware needs reflashing first. Do that once —
see [Flashing firmware](/gateway-development-kit/flashing-firmware/) — then come back here.
:::

### 2. Get networking up

Recovery has no network set up. Plug a copper cable into one of the three
**RJ-45** ports — these are `eth0`, `eth1` and `eth2` (the two SFP+ cages are
`eth3`/`eth4` and need a module) — then bring your port up and grab an address:

```sh
ip link set eth0 up
udhcpc -i eth0
```

(Use whichever RJ-45 you plugged into. If your network has no DHCP, set a static
address with `ip addr add …` and `ip route add default via …` instead. See
[Getting started](/gateway-development-kit/getting-started/) for the physical port order.)

### 3. Download and write the image

Every release lives in its own folder on [openwrt.mono.si](https://openwrt.mono.si),
with a name like `mono-v25.12.5-r1787707074`. That long number changes every single
release, so you can't guess it — you have to go look.

**Step A — find the newest folder's name.** Open
[openwrt.mono.si](https://openwrt.mono.si) in a web browser. You'll see a list of
folders. Pick the one with the **biggest number after `-r`** — that's the newest.
Copy its whole name; you'll paste it in a second.

:::warning
`mono-v25.12.5-rN` is **not** a real folder name — the `rN` is just a stand-in for
"the real number". Do **not** type `rN`. Copy the exact name **you** see on the site
(the one with the long number, like `mono-v25.12.5-r1787707074` — but yours will have
different digits). If you use `rN`, the download fails with "not found".
:::

**Step B — download and write it.** Back in recovery Linux, paste the folder name in
place of `PASTE_THE_FOLDER_NAME_HERE`, then run the whole block:

```sh
cd /tmp

# Paste the newest folder's exact name between the quotes.
# Example: mono-v25.12.5-r1787707074  (yours will have different numbers)
FOLDER="PASTE_THE_FOLDER_NAME_HERE"

# Download the full-disk image and unzip it:
wget https://openwrt.mono.si/$FOLDER/layerscape-armv8_64b-mono_gateway-dk-squashfs-emmc.img.gz
gunzip layerscape-armv8_64b-mono_gateway-dk-squashfs-emmc.img.gz

# Write it to the eMMC — two commands, so the bootloader area is left untouched:
IMG=layerscape-armv8_64b-mono_gateway-dk-squashfs-emmc.img
dd if=$IMG of=/dev/mmcblk0 bs=512 count=8         # partition table (first 4 KB)
dd if=$IMG of=/dev/mmcblk0 bs=1M skip=32 seek=32  # the system, from 32 MB on
sync
```

Did `wget` say the file wasn't found? You almost certainly left `PASTE_THE_FOLDER_NAME_HERE`
(or used `rN`) instead of the real name. Go back to Step A and copy the newest folder exactly.

**Why two writes and not one?** The area from 4 KB to 32 MB on the eMMC belongs to the boot
firmware (the low-level pieces that run before Linux) and its own update tool. The image
leaves it alone: the first command writes the partition table into the first 4 KB, the second
writes the system from 32 MB onward. Nothing in between is ever touched. See Part 2 for the layout.

### 4. Set up A/B booting (one time)

The current image boots from **A/B slots** using an `extlinux` boot script.
Factory units still ship with the older single-slot U-Boot environment, so a
freshly-flashed board needs the A/B boot environment set **once** by hand. After
the first successful boot the image writes the full environment itself, and this
step never repeats.

Set the DIP switch back to **eMMC**, power-cycle, press any key during the
countdown to stop in U-Boot, and paste:

```bash
setenv slot a
setenv set_slot_a 'setenv bootpart 1; setenv rootpart 2'
setenv set_slot_b 'setenv bootpart 3; setenv rootpart 4'
setenv scriptaddr 0x80200000
setenv bootcmd 'run set_slot_${slot}; sysboot mmc 0:${bootpart} any ${scriptaddr} /boot/extlinux/extlinux.conf || run recovery'
setenv bootlimit 3
setenv altbootcmd 'setenv upgrade_available 0; if test ${slot} = a; then setenv slot b; else setenv slot a; fi; setenv bootcount 0; saveenv; run bootcmd'
saveenv
boot
```

:::warning
Paste it exactly, and **don't** add `mono_ab_env_ver` yourself — leaving it
unset lets the image re-assert the complete, correct environment on first boot.
The two common ways this goes wrong: forgetting `setenv scriptaddr …` (which
leaves `sysboot` with an empty address and a broken `bootcmd`), or retyping the
old `emmc_load` / `booti root=…` lines from an older guide — those are the
pre-A/B path and won't boot the current image.
:::

This boots OpenWrt from the active slot and falls back to recovery Linux
automatically if that ever fails. (Once shipping firmware carries the A/B
environment, this whole step disappears — a fresh board will boot straight after
flashing.)

### 5. First boot

The first boot takes a few extra seconds and may restart once on its own: the
board creates the persistent `/data` partition, writes a backup partition table
to the end of the disk, and saves the A/B boot environment to both storage
locations. After that it settles. Then:

* LuCI (the web interface) is at `https://192.168.1.1`
* Ports: the three **RJ-45** ports (`eth0`–`eth2`) are the LAN bridge; the first
  **SFP+** cage (`eth3`) is WAN (DHCP); the second SFP+ (`eth4`) is a second LAN
  (`192.168.2.1`). See [Getting started](/gateway-development-kit/getting-started/) for the physical
  port order.
* Login is `root` with no password — set one.

### Updating

The board updates itself with OpenWrt's **Attended Sysupgrade**: the build
server at `sysupgrade.mono.si` rebuilds an image carrying your exact installed
package set, verifies its signature, and installs it. Because the board is A/B,
the new system is written to the **spare slot** and the board flips to it — so a
failed or interrupted update simply rolls back to the slot you were on.

* **From LuCI:** open **System → Attended Sysupgrade**, click to check, and
  install if an update is offered.
* **From the shell:**

  ```sh
  owut check      # is a newer build available?
  owut upgrade    # rebuild with your packages, verify, install, reboot
  ```

Your settings and everything under `/data` survive the update. One **heads-up**:
writing the new system takes a few seconds; a power cut in exactly that window
leaves the board on its previous slot (or in recovery). Fine on a desk; think
twice for a device in a closet far away.

:::info
**One-time conversion for boards flashed before the squashfs switch.** Earlier
images used a writable `ext4` root; current images use a read-only `squashfs`
root (see [How the image works](#part-2-how-the-image-works)). A board still on
`ext4` will *not* auto-upgrade until you convert it once. Back it up first
(**System → Backup**), then run:

```sh
owut upgrade --fstype squashfs
```

It preserves your settings and everything under `/data`; afterwards plain
`owut upgrade` works as normal. This is a **one-time** step — boards flashed
from a current image are already `squashfs` and can ignore it, and the whole
note goes away once every board has converted.
:::

:::info
**Rolling back on purpose.** The system you upgraded *from* stays in the other
slot until the next update overwrites it, so you can return to it deliberately —
not only when an update fails. Check which slot you're on, flip to the other, and
reboot:

```sh
fw_printenv slot          # a or b — the slot you are on now
mono-fw-setenv slot b     # set it to the OTHER value, then reboot into the old system
reboot
```

`mono-fw-setenv` writes both copies of the boot environment, so the switch holds
no matter how the boot DIP switch is set. It is the same slot flip the board does
on its own after a failed update — here you are just doing it by hand.
:::

### Installing extra packages

The image ships lean — the essentials plus everything the hardware needs — but
the whole OpenWrt package catalogue, and our kernel modules, is available to add.
Because every update rebuilds the image, the right way to add a package is to have
the build server bake it in, so it **survives future updates**:

* **From LuCI:** *System → Attended Sysupgrade* → add the package(s) to the list →
  install.
* **From the shell:**

  ```sh
  owut upgrade -a nano                 # add one package
  owut upgrade -a luci-app-statistics  # an app pulls its dependencies in automatically
  ```

`owut -a` accepts anything in the OpenWrt feeds — a userspace tool, a LuCI app, or
a kernel module — and the rebuilt image comes back with it installed and kept on
every update thereafter.

:::info
`apk add <package>` also works for a quick, one-off install on the running system —
but the board is A/B, so the next Attended Sysupgrade writes a *fresh* slot and an
`apk`-installed package is **not** carried across. For anything you want to keep,
add it with `owut -a` so it lands in the image itself.
:::

## Part 2: How the image works

This part explains what is inside the image and why. You do not need any of it
to use the board.

### Why we build our own image at all

The LS1046A chip in the Gateway has a network engine (called FMan) that can
forward packets entirely in hardware — the CPU never sees them. The software
that drives this is **ASK**, our maintained version of NXP's offloading stack.

We build on **OpenWrt's own kernel** (currently 6.12.x) and layer ASK on top:
the NXP SDK datapath drivers are vendored into the build as plain source files,
and the ASK offload hooks are applied as patches during the build. (This
replaced an older approach that cloned NXP's entire vendor kernel — we now track
OpenWrt's mainline kernel and carry only the ASK pieces.) Everything is fetched
from public sources at pinned versions, so the same inputs always give the same
image, on any machine.

### How offloading actually works

In plain terms:

1. The first packets of every connection go through Linux normally — firewall,
   NAT, routing, all of it.
2. A small daemon called **cmm** watches the connection table. Once a connection
   is established and it knows everything about it (where it goes, what NAT does
   to it), it programs that connection into the FMan's hardware table.
3. From then on, packets of that connection are forwarded, rewritten and NAT-ed
   by the chip itself. The CPU is not involved at all.
4. When the connection dies (or a port goes down, or routing changes), cmm
   removes it from the hardware again.

The firewall still fully applies — rules are enforced on those first packets,
and only connections the firewall allowed ever reach the hardware table.

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
[ASK repository](https://github.com/we-are-mono/ASK) — the kernel patches and
the programs can never get out of step with each other.

A few connection types are deliberately never offloaded (FTP, SIP, PPTP — they
need the CPU to inspect them). The list lives in `/etc/config/fastforward`.

### Board support

Beyond offloading, the image carries the Gateway's board bits:

* **Device tree** describing the board — the same description Armbian and the
  Yocto test image use.
* **LED drivers**: the LP5812 status LED and the SFP link/activity LEDs.
* **Fan control**: the standard lm-sensors `fancontrol` with the same curve as
  our other images — fan off below 40 °C, ramping linearly to full at 80 °C,
  driven by the SoC temperature.
* **Sensors**: the INA-series power monitors, temperature sensors and the fan
  controller all show up under `/sys/class/hwmon`.
* One image serves the whole product family. The only per-device offloading file
  (`cdx_cfg.xml`) ships in all variants and the right one is picked at boot by
  board name — Gateway DK today, Gateway and Gateway Pro when they arrive.

### The eMMC layout (A/B)

```text
0–4 KB      GPT partition table (8 entries, kept clear of the firmware)
4 KB–32 MB  boot firmware: PBL, FIP (U-Boot), U-Boot env, FMan microcode
            (owned by the firmware update tool — never touched by OpenWrt)
32 MB    p1 bootA   64 MiB   slot-A boot (extlinux.conf + Image.gz + dtb)
96 MB    p2 rootA   1 GiB    slot-A rootfs
1120 MB  p3 bootB   64 MiB   slot-B boot   (empty until the first update)
1184 MB  p4 rootB   1 GiB    slot-B rootfs (empty until the first update)
2208 MB  p5 data    ~27.5 GiB persistent /data — survives updates
```

**A/B slots.** There are two rootfs copies. Each is a read-only **squashfs**
image with a writable overlay filling the rest of its 1 GiB slot, so the system
files stay immutable while your changes live in the overlay. An update writes the
*inactive* slot and flips U-Boot to it, keeping the slot you were on as an
automatic rollback: if the new system fails to boot, the board comes back on the
old one. Anything that must persist across updates lives on the separate `/data`
partition. A freshly-flashed image seeds only slot A (p1 + p2); the B slot fills
in on the first update, and `/data` is created on first boot — which is also when
a backup copy of the partition table is written to the end of the disk.

Two unusual choices, both because of the firmware region:

* A normal partition table spills past 4 KB (its list of partitions alone
  reserves 16 KB). Everything from 4 KB to 32 MB belongs to the firmware and its
  update tool, so our table is slimmed down — it lists up to 8 partitions
  instead of the usual 128 — and the whole thing fits in the first 4 KB. Linux
  and U-Boot are fine with that; some desktop partitioning tools may grumble.
* Partitions are created at their final size **in the image**, and the partition
  table is never rewritten afterwards — repartitioning tools would write a
  full-size table right over the firmware.

### How releases happen

We build nightly. Each night the build machine releases in two cases:

* **OpenWrt ships a new stable version** (say v25.12.6): the script moves our
  changes on top of it, rebuilds, and publishes `mono-v25.12.6-rN`.
* **We committed something** (say an ASK update): it rebuilds the same OpenWrt
  base with the new changes and publishes a new `-rN` revision.

Publishing means: images to [openwrt.mono.si](https://openwrt.mono.si), plus
source and a GitHub release to
[we-are-mono/openwrt](https://github.com/we-are-mono/openwrt). Deployed boards
pick it up through Attended Sysupgrade (above).

You can reproduce the exact image yourself: clone the `mono` branch and build in
the repository's pinned Nix environment (`nix run .`) for a reproducible
toolchain — see the repo README for the full commands.

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

```bash
uci set wireless.radio0.band='2g'
uci set wireless.radio0.htmode='HE40'
uci commit wireless
wifi reload
```

Set SSIDs and encryption per device in LuCI as usual.

Both bands run Wi-Fi 6 at 40 MHz-wide channels (HE40). 80 MHz (HE80) on 5 GHz is
currently rejected by the module driver even where the regulatory domain permits
it, so leave 5 GHz at HE40.

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

:::info
**A client that connects but has no internet is almost always DNS.** The
giveaway on an iPhone or iPad: under _Wi-Fi → ⓘ → Configure DNS: Automatic_ the
DNS-server list is **empty**. It associated and got an IP, but has no resolver.

This only happens if something takes over port 53 and moves dnsmasq aside (for
example if you later install **AdGuard Home**, which runs dnsmasq on `5353`) —
dnsmasq then stops advertising _itself_ as the DHCP DNS server. A stock image
uses plain dnsmasq on `:53` and is not affected. If you hit it, hand out a DNS
server explicitly, once per DHCP-served network, each pointing at that network's
own gateway:

```sh
uci add_list dhcp.lan.dhcp_option='6,192.168.1.1'   # repeat per network → its gateway
uci commit dhcp
/etc/init.d/dnsmasq reload
```
:::
