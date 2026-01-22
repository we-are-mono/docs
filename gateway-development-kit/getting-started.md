# Getting started

Before plugging the Development Kit in for the first time, it's worth familiarizing yourself with both: the ports on the back of the device as well as the First boot procedure.

## Connectors

![Development Kit ports](assets/development-kit-backpanel-connectors.png)

More detailed information about the ports is provided in [Hardware description](hardware-description.md)

## First boot

1. Connect the power cable and the UART cable to your computer.
2. Open a serial terminal:
   ```
   tio /dev/ttyUSB0
   ```
   (Adjust the device path if needed—check `ls /dev/ttyUSB*` to find yours.)
3. You should now see output from the device.

Press the reset button to observe the full boot sequence. The device will boot through U-Boot, which displays a countdown before loading the OS. You can either:

- **Let it continue** — boots into OpenWRT on the eMMC.
- **Press any key** — interrupts the countdown and drops you into the U-Boot shell.

### Recovery Linux

To explore the firmware or troubleshoot issues, enter the following in U-Boot:

```
=> run recovery
```

This boots a minimal Linux environment from NOR flash. While its primary purpose is recovering a broken main OS, it's also useful for low-level system maintenance and learning how the components work.

The default user is `root` with no password.

To exit Recovery Linux and boot into OpenWRT:

```
$ reboot
```

### Status LED

During boot, U-Boot runs a series of hardware tests to verify that all I2C devices are present and functioning correctly. This includes power sensors, thermal sensors, the fan controller, power delivery controller, EEPROM, and more.

| LED Color       | Meaning                          |
|-----------------|----------------------------------|
| Green (solid)   | All hardware tests passed        |
| Red (solid)     | One or more tests failed         |
| Orange (pulsing)| Booted into Recovery Linux       |
| White (solid)   | Booted into OpenWRT              |

If the LED turns red, reset the device and check the U-Boot output via the serial console—it will report which chip failed its test.

## Next steps

**Using OpenWRT (default)**

The Development Kit ships with OpenWRT pre-installed. To start using it, simply connect a client device to one of the RJ-45 ports, navigate to `192.168.1.1` in your browser, and use LuCI to configure the device.

**Installing an alternative OS**

If you'd prefer to run Debian or Mono SDK Linux instead, see [Alternative operating systems](alternative-os.md).
