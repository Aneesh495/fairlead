from setuptools import setup, find_packages

setup(
    name="fairlead",
    version="0.1.0",
    description="High-Throughput Smart Order Router and Liquidity Aggregator Client SDK",
    author="Aneesh Krishna",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[],
    entry_points={
        "console_scripts": [
            "fairlead-tui = fairlead.tui:main",
        ]
    }
)
