# Flashing firmware

The Development Kit has two bootable storage devices: a **64 MB NOR flash** and a **32 GB eMMC**. A DIP switch on the PCB selects which one the CPU boots from.

All devices ship with NOR pre-flashed. Since the firmware is under active development, you can flash newer versions as they become available — but this is entirely optional.

## Overview

The recommended procedure is:

1. **Flash eMMC first** (from NOR recovery)
2. Switch to eMMC, verify it boots
3. **Flash NOR** (from eMMC recovery)
4. Switch back to NOR

This order ensures you always have a working recovery environment to fall back on.

{% hint style="danger" %}
**Follow the steps in order.** If you flash NOR without a working eMMC firmware to fall back on, a failed or interrupted flash will brick the device. Recovery requires a hardware programmer or sending the unit back to us.
{% endhint %}

## Prerequisites

- UART serial console connected (see [Getting started](getting-started.md))
- An Ethernet cable connected to one of the ports with access to the internet
- The device's MAC addresses (used for firmware download authentication)

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

## Step 4: Get your MAC addresses

Run `ip a` and note down the MAC addresses of your interfaces. These serve as the password when downloading firmware — use the full address including colons (e.g. `4d:4f:4e:4f:4d:4f`).

```
$ ip a
```

## Step 5: Flash eMMC

Download the eMMC firmware image using your MAC address as the password, then write it to the eMMC:

```
$ curl -ku mono:<mac-address-with-colons> -O https://firmware.mono.si/firmware-emmc.bin
$ dd if=firmware-emmc.bin of=/dev/mmcblk0 bs=4096 skip=1 seek=1
```

{% hint style="info" %}
The `skip=1 seek=1` arguments skip the first 4 KB of both the input file and the output device. The CPU does not use this region, which is where the GPT partition data resides.
{% endhint %}

## Step 6: Switch to eMMC and verify

Flip the DIP switch to **eMMC**. You can do this while the system is still running — no need to power off. Then reboot:

```
$ reboot
```

Watch the serial console output. Confirm you see the following line, which indicates a successful eMMC boot:

```
INFO:    RCW BOOT SRC is SD/EMMC
```

## Step 7: Boot into recovery Linux from eMMC

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

## Step 8: Flash NOR

Download and flash the NOR firmware:

```
$ curl -ku mono:<mac-address-with-colons> -O https://firmware.mono.si/firmware-qspi.bin
$ flashcp -v firmware-qspi.bin /dev/mtd0
```

## Step 9: Switch back to NOR and reboot

Flip the DIP switch back to **NOR**, then reboot:

```
$ reboot
```

Both storage devices are now running the latest firmware. If you backed up custom U-Boot environment variables in Step 1, restore them now using `setenv` and `saveenv`.

## Note for custom OS images

If you are building your own operating system images for the eMMC, make sure your partitions start at an offset of **32 MB** or greater from the beginning of the device. The first 32 MB of the eMMC is reserved for the firmware (bootloader, U-Boot, and recovery Linux). Keeping your OS partitions beyond this boundary ensures you can always re-flash the firmware without overwriting your operating system data.
