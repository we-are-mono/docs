# Flashing firmware

The Development Kit has two bootable storage devices: a **64 MB NOR flash** and a **32 GB eMMC**. A DIP switch on the PCB selects which one the CPU boots from.

All devices ship with NOR pre-flashed. Since the firmware is under active development, you can flash newer versions as they become available — but this is entirely optional.

## Overview

The built-in `firmware` tool auto-detects which medium the device booted from and always flashes the other one. This ensures you never overwrite the firmware you are currently running from.

The recommended procedure is:

1. Boot into recovery from **NOR**, run `firmware update` (flashes eMMC)
2. Switch DIP to eMMC, verify it boots
3. Boot into recovery from **eMMC**, run `firmware update` (flashes NOR)
4. Switch DIP back to NOR

This order ensures you always have a working recovery environment to fall back on.

{% hint style="danger" %}
**Follow the steps in order.** If you flash NOR without a working eMMC firmware to fall back on, a failed or interrupted flash will brick the device. Recovery requires a hardware programmer or sending the unit back to us.
{% endhint %}

## Prerequisites

- UART serial console connected (see [Getting started](getting-started.md))
- An Ethernet cable connected to one of the ports with access to the internet

## Step 1: Back up U-Boot environment variables

Flashing firmware resets U-Boot environment variables back to factory defaults. If you have customized any variables (e.g. for OPNsense or a custom boot configuration), you should save them before proceeding.

Interrupt the U-Boot countdown and run:

```
=> pri
```

Copy and paste the entire output somewhere safe. After flashing, you can restore any custom variables with `setenv` and `saveenv`.

## Step 2: Boot into recovery Linux from NOR

Ensure the DIP switch is set to **NOR** (this is the factory default). From the U-Boot shell, run:

```
=> run recovery
```

Log in as `root` (no password required).

## Step 3: Set up networking

Recovery Linux has no DHCP, so you need to configure the network manually. Pick the interface that matches the port you connected your cable to:

| Port (left to right) | Interface |
|----------------------|-----------|
| 1                    | eth1      |
| 2                    | eth2      |
| 3                    | eth0      |
| 4 (SFP+)             | eth3      |
| 5 (SFP+)             | eth4      |

{% hint style="info" %}
The non-sequential interface naming is a cosmetic hardware quirk — the interfaces work correctly, they are just enumerated out of order.
{% endhint %}

For example, if using the third RJ-45 port (eth0):

```
$ ip link set eth0 up
$ ip addr add 10.0.0.69/24 dev eth0
$ ip route add default via 10.0.0.1 dev eth0
```

Adjust the interface, IP address, and gateway to match your setup.

## Step 4: Flash eMMC

Run the firmware update tool:

```
$ firmware update
```

The tool will download the eMMC firmware, verify its signature, and flash it. Follow the on-screen prompts.

## Step 5: Switch to eMMC and verify

Flip the DIP switch to **eMMC**. You can do this while the system is still running — no need to power off. Then reboot:

```
$ reboot
```

Watch the serial console output. Confirm you see the following line, which indicates a successful eMMC boot:

```
INFO:    RCW BOOT SRC is SD/EMMC
```

## Step 6: Boot into recovery Linux from eMMC

Now that eMMC is verified, interrupt the U-Boot countdown again and enter recovery:

```
=> run recovery
```

This time, recovery Linux is loaded from eMMC. Log in as `root` and set up networking the same way as in Step 3:

```
$ ip link set <interface> up
$ ip addr add 10.0.0.69/24 dev <interface>
$ ip route add default via 10.0.0.1 dev <interface>
```

## Step 7: Flash NOR

Run the firmware update tool again:

```
$ firmware update
```

Since you are now booted from eMMC, the tool will automatically target NOR.

## Step 8: Switch back to NOR and reboot

Flip the DIP switch back to **NOR**, then reboot:

```
$ reboot
```

Both storage devices are now running the latest firmware. If you backed up custom U-Boot environment variables in Step 1, restore them now using `setenv` and `saveenv`.

## Manual flashing (legacy)

If your device has an older firmware without the `firmware` command, you can download and flash manually. Replace `<mac-address-with-colons>` with your device's MAC address in lowercase format (e.g. `4d:4f:4e:4f:4d:4f`). Run `ip a` to find it.

**eMMC:**

```
$ curl -u mono:<mac-address-with-colons> -O https://firmware.mono.si/firmware-emmc.bin
$ dd if=firmware-emmc.bin of=/dev/mmcblk0 bs=4096 skip=1 seek=1
```

{% hint style="info" %}
The `skip=1 seek=1` arguments skip the first 4 KB of both the input file and the output device. The CPU does not use this region, which is where the GPT partition data resides.
{% endhint %}

**NOR:**

```
$ curl -u mono:<mac-address-with-colons> -O https://firmware.mono.si/firmware-qspi.bin
$ flashcp -v firmware-qspi.bin /dev/mtd0
```

## Note for custom OS images

If you are building your own operating system images for the eMMC, make sure your partitions start at an offset of **32 MB** or greater from the beginning of the device. The first 32 MB of the eMMC is reserved for the firmware (bootloader, U-Boot, and recovery Linux). Keeping your OS partitions beyond this boundary ensures you can always re-flash the firmware without overwriting your operating system data.
