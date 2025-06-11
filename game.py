<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monster Survivors - Epic Survival Adventure Game | GameStudent.xyz</title>
    <meta name="description" content="Play Monster Survivors online - An intense survival game where you battle endless waves of monsters. Test your skills and survive as long as possible!">
    <link rel="canonical" href="https://gamestudent.xyz/monster-survivors" />
    <style>
        :root {
            --apple-blue: #007AFF;
            --apple-gray: #8E8E93;
            --apple-background: #F5F5F7;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #1D1D1F;
            background-color: var(--apple-background);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            text-align: center;
            padding: 40px 0;
        }
        h1 {
            font-size: 2.5rem;
            color: var(--apple-blue);
            margin-bottom: 20px;
        }
        .game-intro {
            font-size: 1.2rem;
            color: var(--apple-gray);
            margin-bottom: 30px;
        }
        .game-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            aspect-ratio: 16/9;
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            position: relative;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .game-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
            background: #000;
        }
        .iframe-fallback {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            color: #fff;
            font-size: 1.2rem;
            z-index: 2;
            text-align: center;
            padding: 20px;
        }
        .game-info {
            margin-top: 40px;
        }
        h2 {
            color: var(--apple-blue);
            margin: 30px 0 15px;
            font-size: 1.8rem;
        }
        p {
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }
            .game-intro {
                font-size: 1rem;
            }
            h2 {
                font-size: 1.5rem;
            }
            p {
                font-size: 1rem;
            }
            .container {
                padding: 15px;
            }
            .game-container {
                min-height: 180px;
            }
        }
    </style>
    <script>
        // 检查iframe是否加载成功，否则显示提示
        function handleIframeError() {
            document.getElementById('iframe-fallback').style.display = 'flex';
        }
        function handleIframeLoad() {
            document.getElementById('iframe-fallback').style.display = 'none';
        }
        window.addEventListener('DOMContentLoaded', function() {
            var iframe = document.getElementById('game-iframe');
            var fallback = document.getElementById('iframe-fallback');
            // 10秒后如果iframe还没加载，显示提示
            var timeout = setTimeout(function() {
                fallback.style.display = 'flex';
            }, 10000);
            iframe.onload = function() {
                clearTimeout(timeout);
                fallback.style.display = 'none';
            };
            iframe.onerror = function() {
                clearTimeout(timeout);
                fallback.style.display = 'flex';


