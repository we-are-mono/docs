---
title: "Restoring device tree"
section: "Gateway development kit"
order: 6
---

When user does not follow the steps for upgrading OpenWRT, it can happen the bootloader data will get overwritten.
This how-to should help the user to get the router to correct bootable state.

## Part 1: Problem description

During flashing of OpenWRT, user can by mistake use incorrect parameters for the **dd** command, overwriting the bootloader.
The startup process will fail, u-boot will stop with following output:
```
Retrieving file: /boot/extlinux/extlinux.conf
** No partition table - mmc 0 **
Couldn't find partition mmc 0:1
Error reading config file
SF: Detected mt25qu512abb with page size 256 Bytes, erase size 64 KiB, total 64 MiB
device 0 offset 0xa00000, size 0x1600000
SF: 23068672 bytes @ 0xa00000 Read: OK
device 0 offset 0x500000, size 0x100000
SF: 1048576 bytes @ 0x500000 Read: OK
   Uncompressing Kernel Image to 0
ERROR: Did not find a cmdline Flattened Device Tree
Could not find a valid device tree
```
Command `run recovery` will result in similar problem:
```
=> run recovery
SF: Detected mt25qu512abb with page size 256 Bytes, erase size 64 KiB, total 64 MiB
device 0 offset 0xa00000, size 0x1600000
SF: 23068672 bytes @ 0xa00000 Read: OK
device 0 offset 0x500000, size 0x100000
SF: 1048576 bytes @ 0x500000 Read: OK
   Uncompressing Kernel Image to 0
ERROR: Did not find a cmdline Flattened Device Tree
Could not find a valid device tree
```


### 1. Prepare TFTP server

To get the necessary data to your gateway, you need to have TFTP server available on the same network as your router.
Good guide to set the server up on Ubuntu can be found [here](https://linuxvox.com/blog/linux-tftp-server-ubuntu/).

### 2. Gaining the device MAC address

To get the binary file, you will need to access the mono firmware website. The site requires authentication. The username is **mono**, but the password is your MAC address of the device.
To gain the MAC address, connect to the gateway's serial port.
On your PC, start a serial console (e.g. on Ubuntu, run terminal command tio /dev/ttyUSB0).
Now start the gateway (or reset the device).
As it is bricked, u-boot will anyhow not be able to start, so you can just wait until you will be dropped back to the u-boot shell.
Once the prompt is available (you will see just `=>` in your serial terminal window) type command `pri`.
This will print out all environment variables. Scroll up and find the variable `ethaddr`. The line will look like
```
ethaddr=E8:F6:D7:xx:xx:xx
```
Copy the value (starting with E8 in the above example) **including the colons** - this will be used as a password to download the file.

### 3. Downloading the firmware file

On your Ubuntu workstation, issue command
```
curl -fS -u "mono:[MAC]" \
  -o firmware-emmc-gateway-dk.bin \
  "https://firmware.mono.si/firmware-emmc-gateway-dk.bin"
```
Replace the [MAC] with the value from [step 2](#2-Gaining-the-device-MAC-address).
Copy the file to your TFTP server root directory - if you used the how-to from [step 1](#1-Prepare-TFTP-server), this will be /srv/tftp.
You can use command such as `sudo cp firmware-emmc-gateway-dk.bin /srv/tftp`.

### 4. Setting up IP address

In order to proceed, you will need following information:
- your TFTP server IP address
- one free IP address on the same network as the TFTP server
- your default IP gateway

If you used your own computed to install TFTP as documented in [step 1](#1-Prepare-TFTP-server), 

Log in as `root` — no password.

:::info
If `run recovery` fails with `Bad Linux ARM64 Image magic!` (or similar), the
board's low-level firmware needs reflashing first. Do that once —
see [Flashing firmware](/gateway-development-kit/flashing-firmware/) — then come back here.
:::

### 2. Get networking up

