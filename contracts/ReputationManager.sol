// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationManager
 * @dev Simple reputation registry. Controlled by accounts with MANAGER_ROLE.
 * Exposes increase/decrease/get functions for other contracts (e.g., VoucherEscrow).
 */
contract ReputationManager is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    mapping(address => uint256) private _reputation;

    event ReputationChanged(address indexed who, int256 delta, uint256 newScore);

    constructor(address admin) {
        address _admin = admin == address(0) ? msg.sender : admin;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
    }

    /// @notice Increase reputation for `who` by `amount`.
    function increaseReputation(address who, uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(who != address(0), "zero address");
        _reputation[who] += amount;
        emit ReputationChanged(who, int256(int256(amount)), _reputation[who]);
    }

    /// @notice Decrease reputation for `who` by `amount` (floor at 0).
    function decreaseReputation(address who, uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(who != address(0), "zero address");
        uint256 current = _reputation[who];
        if (amount >= current) {
            _reputation[who] = 0;
            emit ReputationChanged(who, -int256(int256(current)), 0);
        } else {
            _reputation[who] = current - amount;
            emit ReputationChanged(who, -int256(int256(amount)), _reputation[who]);
        }
    }

    /// @notice Read reputation score.
    function getReputation(address who) external view returns (uint256) {
        return _reputation[who];
    }

    /// @notice Allows admin to grant manager role to another address (multisig recommended in prod).
    function grantManager(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MANAGER_ROLE, account);
    }
}
