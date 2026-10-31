import 'package:flutter/material.dart';

const canvasColor = Color(0xffffffff),
    panelColor = Color(0xfff8fafd),
    cardColor = Color(0xffffffff),
    lineColor = Color(0xffe5edf5),
    bodyColor = Color(0xff061b31),
    inkColor = Color(0xff061b31),
    mutedColor = Color(0xff64748d),
    accentColor = Color(0xff533afd);
ThemeData nodraTheme() => ThemeData(
  brightness: Brightness.light,
  scaffoldBackgroundColor: canvasColor,
  colorScheme: const ColorScheme.light(
    primary: accentColor,
    onPrimary: canvasColor,
    surface: panelColor,
    onSurface: bodyColor,
    secondary: accentColor,
    error: inkColor,
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 38,
      height: 1.05,
      letterSpacing: -1.5,
      fontWeight: FontWeight.w300,
      color: inkColor,
    ),
    headlineMedium: TextStyle(
      fontSize: 28,
      height: 1.05,
      letterSpacing: -.9,
      fontWeight: FontWeight.w300,
      color: inkColor,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      letterSpacing: -.4,
      fontWeight: FontWeight.w300,
      color: inkColor,
    ),
    bodyMedium: TextStyle(fontSize: 16, height: 1.4, color: bodyColor),
    bodySmall: TextStyle(fontSize: 12, height: 1.4, color: mutedColor),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: canvasColor,
    foregroundColor: inkColor,
    elevation: 0,
    scrolledUnderElevation: 0,
  ),
  dividerColor: lineColor,
  cardTheme: CardThemeData(
    color: cardColor,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(26),
      side: const BorderSide(color: lineColor),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: cardColor,
    contentPadding: const EdgeInsets.all(14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: const BorderSide(color: lineColor),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: const BorderSide(color: lineColor),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: const BorderSide(color: accentColor),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: accentColor,
      foregroundColor: canvasColor,
      minimumSize: const Size(48, 48),
      shape: const StadiumBorder(),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: accentColor,
      minimumSize: const Size(48, 48),
      side: const BorderSide(color: lineColor),
      shape: const StadiumBorder(),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: panelColor,
    indicatorColor: const Color(0xffe8e9ff),
    indicatorShape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
    ),
  ),
);
