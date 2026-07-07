# Installing OpenWRT on the Mono Gateway (LS1046A)

Flashes the OpenWRT ext4 rootfs to eMMC and boots it via U-Boot.

## Updates

Mono Gateway development kit fllashed with our own OpenWRT image, can and should **not** be updated. For now...

## 1. Set up networking in recovery


Boot to recovery linux by interrupting (press any key) U-boot and run recovery.

```sh
run recovery
```

Bring up `eth0` and set a static address so `curl` can reach the network.
Adjust IP and gateway to your subnet!

```sh
ip link set eth0 up
ip addr add 10.99.0.233/24 dev eth0
ip route add default via 10.99.0.1
```

## 2. Partition eMMC

Wipe and create a ext4 partition.

```sh
parted /dev/mmcblk0 mklabel gpt -s
parted /dev/mmcblk0 mkpart primary ext4 32MiB 100% -s
```

## 3. Download the rootfs

```sh
curl -kO https://mono.si/openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4.gz
gunzip openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4.gz
```

## 4. Write OpenWRT to eMMC (first partition)

```sh
dd if=openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4 of=/dev/mmcblk0p1 bs=1M
sync
```

## 5. Set U-Boot boot vars

```
=> setenv emmc 'setenv bootargs "${bootargs_console} boot_medium=emmc root=/dev/mmcblk0p1 rw rootwait rootfstype=ext4 ${bootargs_hwtest}"; ext4load mmc 0:1 ${kernel_addr_r} /boot/kernel.itb && bootm ${kernel_addr_r}'
=> setenv bootcmd 'run emmc || run recovery'
=> saveenv
```

## 6. Boot

```
=> boot
```

## 7. Write fresh firmware again

Earlier we wiped the eMMC while creating new partions. So, to refresh the firmware in the QSPI/boot region (0–32 MiB):

1. Set the DIP switch to **NOR**.
2. Reboot into recovery Linux.
3. Set up networking (check the start of this docs - step 1)
4. Run the update:

   ```sh
   firmware update
   ```

5. Set the DIP switch back to **eMMC**.
6. Reboot.
