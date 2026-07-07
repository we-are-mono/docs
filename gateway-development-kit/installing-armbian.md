# Installing Armbian

This guide walks through flashing Armbian to the Development Kit's **eMMC** from Recovery Linux.

The procedure boots Recovery Linux from **NOR**, writes the Armbian image to eMMC over the network, then switches the DIP switch to boot Armbian from eMMC. Because Recovery runs from NOR, overwriting the entire eMMC is safe — you always retain a working recovery environment on NOR.

## Prerequisites

* UART serial console connected (see [Getting started](/gateway-development-kit/getting-started.md))
* An Ethernet cable connected to one of the ports with access to the internet
* DIP switch currently set to **NOR** (factory default)

## Updates

Armbian can be update normally after it is installed on Mono Gateway developmnet kit.

## Step 1: Boot into Recovery Linux

Connect the UART cable and open a serial terminal:

```
tio /dev/ttyUSB0
```

Reset the device, interrupt the U-Boot countdown by pressing any key, then boot Recovery:

```
=> run recovery
```

Log in as `root` (no password). The status LED pulses **orange** in Recovery Linux.

## Step 2: Set up networking

Recovery Linux has no DHCP, so configure the network manually. Pick the interface matching the port your cable is connected to:

| Port (left to right) | Interface |
| -------------------- | --------- |
| 1                    | eth1      |
| 2                    | eth2      |
| 3                    | eth0      |
| 4 (SFP+)             | eth3      |
| 5 (SFP+)             | eth4      |

For example, using the port mapped to `eth0`:

```
ip link set eth0 up
ip addr add 10.0.0.69/24 dev eth0
ip route add default via 10.0.0.1 dev eth0
```

Adjust the interface, IP address, and gateway to match your network.

## Step 3: Flash Armbian to eMMC

Stream, decompress, and write the image directly to the eMMC (`/dev/mmcblk0`) in one pipeline. This takes a few minutes.

**Make sure to replace the `ARMBIAN-IMAGE-DOWNLOAD-LINK.xz` with the actual link from [https://armbian.com/boards/gateway-dk](https://armbian.com/boards/gateway-dk)**


```
curl -sL ARMBIAN-IMAGE-DOWNLOAD-LINK.xz | xz -d | dd of=/dev/mmcblk0 bs=4M
```

## Step 4: Switch the DIP switch to eMMC

Flip the DIP switch to **eMMC**. You can do this while the system is running — no need to power off.

## Step 5: Reboot

```
reboot
```

Watch the serial console. A successful eMMC boot shows:

```
INFO:    RCW BOOT SRC is SD/EMMC
```

## Step 6: Write fresh firmware again

Earlier we wiped the eMMC while writing the image to it, so we need to write firmware back to eMMC.

1. Set the DIP switch to **NOR**.
2. Reboot into recovery Linux.
3. Set up networking (check the start of this docs - step 2)
4. Run the update:

   ```sh
   firmware update
   ```

5. Set the DIP switch back to **eMMC**.
6. Reboot.
